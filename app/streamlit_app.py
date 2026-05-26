from __future__ import annotations

from pathlib import Path

import pandas as pd
import streamlit as st

from ledger.db import DEFAULT_DB_PATH, connect_db
from ledger.enums import ASSISTANTS, ATTRIBUTIONS, PROJECTS, REVIEW_STATUSES
from ledger.export_packets import export_attribution_packet, export_postmortem_packet, save_packet
from ledger.grouping import suggest_candidate_groups
from ledger.import_trades import import_trades_csv
from ledger.transcript_import import import_transcript_text
from ledger.services import (
    add_assistant_attribution,
    create_decision,
    create_or_update_postmortem,
    edit_decision,
    fetch_decisions,
    fetch_trades,
    fetch_unlinked_trades,
    get_attributions_for_decision,
    get_attributions_for_trade,
    get_linked_trades,
    get_postmortems,
    link_trades_to_decision,
    mark_attribution_review_status,
)

RAW_EXPORTS_DIR = Path("data/raw_exports")
PROCESSED_DIR = Path("data/processed")


st.set_page_config(page_title="Polygraph", layout="wide")
st.title("Polygraph")
st.caption("Local-first Polymarket trade ledger, attribution, and post-mortems.")

conn = connect_db(DEFAULT_DB_PATH)
RAW_EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

tabs = st.tabs(
    [
        "Import Trades",
        "Import Transcripts",
        "Trade Ledger",
        "Unlinked Trades",
        "Decisions",
        "Assistant Attribution",
        "Post-Mortems",
        "Export Review Packets",
    ]
)


def dataframe(rows: list[dict]) -> None:
    st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)


with tabs[0]:
    st.subheader("Import Trades")
    files = sorted(RAW_EXPORTS_DIR.glob("*.csv"))
    if not files:
        st.info("Place CSV exports in data/raw_exports/ and refresh this page.")
    selected = st.selectbox("CSV file", files, format_func=lambda p: p.name if p else "")
    if selected and st.button("Import selected CSV"):
        try:
            result = import_trades_csv(conn, selected)
            st.success("Import finished")
            st.json(
                {
                    "rows_seen": result.rows_seen,
                    "rows_imported": result.rows_imported,
                    "duplicates_skipped": result.duplicates_skipped,
                    "errors": result.errors,
                }
            )
        except Exception as exc:
            st.error(str(exc))

with tabs[1]:
    st.subheader("Import Transcripts")
    uploaded = st.file_uploader(
        "Transcript file (.txt, .md, .json)",
        type=["txt", "md", "json"],
        help="Plain text (Human:/Assistant: labels) or ChatGPT JSON export.",
    )
    assistant = st.selectbox("Assistant", sorted(ASSISTANTS), key="transcript_assistant")
    if uploaded:
        fmt = "chatgpt_json" if uploaded.name.lower().endswith(".json") else "plain"
        text = uploaded.read().decode("utf-8", errors="replace")
        st.caption(f"Detected format: **{fmt}** — {len(text):,} chars")
        if st.button("Import transcript"):
            try:
                result = import_transcript_text(conn, text, assistant, uploaded.name, fmt=fmt)
                st.success(
                    f"Created {result.attributions_created} attribution(s) from "
                    f"{result.assistant_turns} assistant turn(s)."
                )
                st.json(
                    {
                        "turns_parsed": result.turns_parsed,
                        "assistant_turns": result.assistant_turns,
                        "matches_found": result.matches_found,
                        "attributions_created": result.attributions_created,
                        "duplicates_skipped": result.duplicates_skipped,
                        "errors": result.errors,
                    }
                )
            except Exception as exc:
                st.error(str(exc))

with tabs[2]:
    st.subheader("Trade Ledger")
    c1, c2, c3, c4, c5 = st.columns(5)
    project = c1.selectbox("Project", [""] + sorted(PROJECTS))
    market_text = c2.text_input("Market contains")
    outcome = c3.text_input("Outcome")
    side = c4.text_input("Side")
    action = c5.text_input("Action")
    linked_filter = st.radio("Link status", ["All", "Linked", "Unlinked"], horizontal=True)
    linked = None if linked_filter == "All" else linked_filter == "Linked"
    rows = fetch_trades(
        conn,
        project=project or None,
        market_text=market_text or None,
        outcome=outcome or None,
        side=side or None,
        action=action or None,
        linked=linked,
    )
    dataframe(rows)

with tabs[3]:
    st.subheader("Unlinked Trades")
    unlinked = fetch_unlinked_trades(conn)
    dataframe(unlinked)
    st.markdown("#### Suggested Groups")
    suggestions = suggest_candidate_groups(unlinked)
    dataframe(suggestions)

    decisions = fetch_decisions(conn)
    decision_ids = [d["decision_id"] for d in decisions]
    trade_ids = [t["trade_id"] for t in unlinked]
    with st.form("link_unlinked"):
        selected_trades = st.multiselect("Trades to link", trade_ids)
        selected_decision = st.selectbox("Decision", decision_ids)
        confidence = st.slider("Link confidence", 0.0, 1.0, 1.0, 0.05)
        submitted = st.form_submit_button("Link trades")
        if submitted:
            try:
                link_trades_to_decision(
                    conn, selected_trades, selected_decision, confidence, "USER"
                )
                st.success("Trades linked")
            except Exception as exc:
                st.error(str(exc))

with tabs[4]:
    st.subheader("Decisions")
    with st.expander("Create decision", expanded=True):
        with st.form("create_decision"):
            project = st.selectbox("Project", sorted(PROJECTS), index=sorted(PROJECTS).index("EXPERIMENTAL"))
            sleeve = st.text_input("Sleeve")
            market_slug = st.text_input("Market slug")
            market_title = st.text_input("Market title")
            outcome = st.text_input("Outcome")
            side = st.text_input("Side")
            intent = st.text_input("Intent")
            decision_type = st.text_input("Decision type")
            price_used = st.number_input("Price used", min_value=0.0, max_value=1.0, value=0.0)
            thesis_summary = st.text_area("Thesis summary")
            rule_summary = st.text_area("Rule summary")
            user_notes = st.text_area("User notes")
            if st.form_submit_button("Create"):
                try:
                    decision = create_decision(
                        conn,
                        project=project,
                        sleeve=sleeve,
                        market_slug=market_slug,
                        market_title=market_title,
                        outcome=outcome,
                        side=side,
                        intent=intent,
                        decision_type=decision_type,
                        price_used=price_used or None,
                        thesis_summary=thesis_summary,
                        rule_summary=rule_summary,
                        user_notes=user_notes,
                    )
                    st.success(f"Created {decision['decision_id']}")
                except Exception as exc:
                    st.error(str(exc))

    decisions = fetch_decisions(conn)
    dataframe(decisions)
    if decisions:
        selected_decision = st.selectbox("Edit/view decision", [d["decision_id"] for d in decisions])
        current = next(d for d in decisions if d["decision_id"] == selected_decision)
        with st.form("edit_decision"):
            status = st.text_input("Status", current.get("status") or "")
            notes = st.text_area("User notes", current.get("user_notes") or "")
            thesis = st.text_area("Thesis summary", current.get("thesis_summary") or "")
            if st.form_submit_button("Save edits"):
                try:
                    edit_decision(
                        conn,
                        selected_decision,
                        status=status,
                        user_notes=notes,
                        thesis_summary=thesis,
                    )
                    st.success("Decision updated")
                except Exception as exc:
                    st.error(str(exc))
        st.markdown("#### Linked Trades")
        dataframe(get_linked_trades(conn, selected_decision))

with tabs[5]:
    st.subheader("Assistant Attribution")
    trades = fetch_trades(conn)
    decisions = fetch_decisions(conn)
    trade_ids = [""] + [t["trade_id"] for t in trades]
    decision_ids = [""] + [d["decision_id"] for d in decisions]
    with st.form("add_attribution"):
        trade_id = st.selectbox("Trade ID", trade_ids)
        decision_id = st.selectbox("Decision ID", decision_ids)
        assistant = st.selectbox("Assistant", sorted(ASSISTANTS))
        attribution = st.selectbox("Attribution", sorted(ATTRIBUTIONS))
        evidence = st.text_area("Evidence")
        evidence_source = st.text_input("Evidence source")
        recommended_price = st.number_input("Recommended price", min_value=0.0, max_value=1.0, value=0.0)
        recommended_size = st.number_input("Recommended size", min_value=0.0, value=0.0)
        match_quality = st.slider("Match quality", 0.0, 1.0, 0.0, 0.05)
        review_status = st.selectbox("Review status", sorted(REVIEW_STATUSES))
        if st.form_submit_button("Add attribution"):
            try:
                added = add_assistant_attribution(
                    conn,
                    trade_id=trade_id or None,
                    decision_id=decision_id or None,
                    assistant=assistant,
                    attribution=attribution,
                    evidence=evidence,
                    evidence_source=evidence_source,
                    recommended_price=recommended_price or None,
                    recommended_size=recommended_size or None,
                    match_quality=match_quality,
                    review_status=review_status,
                )
                st.success(f"Added {added['attribution_id']}")
            except Exception as exc:
                st.error(str(exc))

    st.markdown("#### Existing Attributions")
    lookup_trade = st.selectbox("View by trade", trade_ids, key="lookup_trade")
    lookup_decision = st.selectbox("View by decision", decision_ids, key="lookup_decision")
    rows = []
    if lookup_trade:
        rows.extend(get_attributions_for_trade(conn, lookup_trade))
    if lookup_decision:
        rows.extend(get_attributions_for_decision(conn, lookup_decision))
    dataframe(rows)
    if rows:
        attribution_id = st.selectbox("Attribution to update", [r["attribution_id"] for r in rows])
        new_status = st.selectbox("New review status", sorted(REVIEW_STATUSES), key="new_status")
        if st.button("Update review status"):
            try:
                mark_attribution_review_status(conn, attribution_id, new_status)
                st.success("Review status updated")
            except Exception as exc:
                st.error(str(exc))

with tabs[6]:
    st.subheader("Post-Mortems")
    decisions = fetch_decisions(conn)
    decision_ids = [d["decision_id"] for d in decisions]
    if decision_ids:
        selected_decision = st.selectbox("Decision", decision_ids, key="pm_decision")
        with st.form("postmortem_form"):
            pnl = st.number_input("PnL", value=0.0)
            thesis_quality = st.text_input("Thesis quality")
            execution_quality = st.text_input("Execution quality")
            sizing_quality = st.text_input("Sizing quality")
            exit_quality = st.text_input("Exit quality")
            rule_read_quality = st.text_input("Rule read quality")
            primary_error_type = st.text_input("Primary error type")
            secondary_error_type = st.text_input("Secondary error type")
            what_went_right = st.text_area("What went right")
            what_went_wrong = st.text_area("What went wrong")
            lesson_keep = st.text_area("Lesson keep")
            lesson_change = st.text_area("Lesson change")
            never_repeat = st.text_area("Never repeat")
            future_rule = st.text_area("Future rule")
            markdown_body = st.text_area("Markdown body")
            if st.form_submit_button("Save post-mortem"):
                try:
                    pm = create_or_update_postmortem(
                        conn,
                        selected_decision,
                        pnl=pnl,
                        thesis_quality=thesis_quality,
                        execution_quality=execution_quality,
                        sizing_quality=sizing_quality,
                        exit_quality=exit_quality,
                        rule_read_quality=rule_read_quality,
                        primary_error_type=primary_error_type,
                        secondary_error_type=secondary_error_type,
                        what_went_right=what_went_right,
                        what_went_wrong=what_went_wrong,
                        lesson_keep=lesson_keep,
                        lesson_change=lesson_change,
                        never_repeat=never_repeat,
                        future_rule=future_rule,
                        markdown_body=markdown_body,
                    )
                    st.success(f"Saved {pm['postmortem_id']}")
                except Exception as exc:
                    st.error(str(exc))
    dataframe(get_postmortems(conn))

with tabs[7]:
    st.subheader("Export Review Packets")
    trades = fetch_trades(conn)
    decisions = fetch_decisions(conn)
    trade_ids = [""] + [t["trade_id"] for t in trades]
    decision_ids = [""] + [d["decision_id"] for d in decisions]
    packet_type = st.radio("Packet type", ["Attribution", "Post-mortem"], horizontal=True)
    if packet_type == "Attribution":
        trade_id = st.selectbox("Trade ID", trade_ids, key="export_trade")
        decision_id = st.selectbox("Decision ID", decision_ids, key="export_decision")
        if st.button("Generate attribution packet"):
            try:
                packet = export_attribution_packet(conn, trade_id or None, decision_id or None)
                st.text_area("Packet", packet, height=500)
                base = trade_id or decision_id or "packet"
                saved = save_packet(packet, PROCESSED_DIR, f"attribution_{base}.md")
                st.success(f"Saved {saved}")
            except Exception as exc:
                st.error(str(exc))
    else:
        decision_id = st.selectbox("Decision ID", decision_ids, key="export_pm_decision")
        if st.button("Generate post-mortem packet"):
            try:
                packet = export_postmortem_packet(conn, decision_id)
                st.text_area("Packet", packet, height=500)
                saved = save_packet(packet, PROCESSED_DIR, f"postmortem_{decision_id}.md")
                st.success(f"Saved {saved}")
            except Exception as exc:
                st.error(str(exc))

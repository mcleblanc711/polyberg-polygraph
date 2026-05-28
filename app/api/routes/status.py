from fastapi import APIRouter, Depends
from app.api.deps import get_db

router = APIRouter()


@router.get("/status")
def get_status(conn=Depends(get_db)):
    trades = conn.execute("SELECT COUNT(*) FROM trades_raw").fetchone()[0]
    decisions = conn.execute("SELECT COUNT(*) FROM decisions").fetchone()[0]
    attributions = conn.execute("SELECT COUNT(*) FROM assistant_attributions").fetchone()[0]
    postmortems = conn.execute("SELECT COUNT(*) FROM postmortems").fetchone()[0]
    needs_review = conn.execute(
        "SELECT COUNT(*) FROM assistant_attributions WHERE review_status = 'NEEDS_REVIEW'"
    ).fetchone()[0]
    unlinked = conn.execute(
        """SELECT COUNT(*) FROM trades_raw t
           WHERE NOT EXISTS (
               SELECT 1 FROM trade_decision_links l WHERE l.trade_id = t.trade_id
           )"""
    ).fetchone()[0]
    pending_pm = conn.execute(
        """SELECT COUNT(*) FROM decisions d
           WHERE NOT EXISTS (
               SELECT 1 FROM postmortems p WHERE p.decision_id = d.decision_id
           )"""
    ).fetchone()[0]
    return {
        "trades": trades,
        "decisions": decisions,
        "attributions": attributions,
        "postmortems": postmortems,
        "needs_review": needs_review,
        "unlinked": unlinked,
        "pending_pm": pending_pm,
    }

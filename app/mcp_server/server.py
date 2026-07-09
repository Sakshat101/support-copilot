"""Self-built MCP server exposing order/customer tools to the agent.
Run standalone with: python -m app.mcp_server.server
Or inspect with: fastmcp dev app/mcp_server/server.py
"""
import psycopg
from fastmcp import FastMCP
from app.config import settings

mcp = FastMCP("support-copilot-mcp")


@mcp.tool()
def get_order(order_id: str) -> dict:
    """Fetch an order's status and amount by order_id."""
    with psycopg.connect(settings.database_url) as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT order_id, status, amount FROM orders WHERE order_id = %s",
            (order_id,),
        )
        row = cur.fetchone()
        if not row:
            return {"error": "order not found"}
        return {"order_id": row[0], "status": row[1], "amount": float(row[2])}


@mcp.tool()
def get_customer_orders(customer_id: str) -> list[dict]:
    """List all orders for a given customer_id."""
    with psycopg.connect(settings.database_url) as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT order_id, status, amount FROM orders WHERE customer_id = %s",
            (customer_id,),
        )
        rows = cur.fetchall()
        return [{"order_id": r[0], "status": r[1], "amount": float(r[2])} for r in rows]


@mcp.tool(annotations={"needs_approval": True})
def issue_refund(order_id: str, amount: float) -> dict:
    """Issue a refund for an order. Requires human approval before execution."""
    with psycopg.connect(settings.database_url) as conn, conn.cursor() as cur:
        cur.execute("UPDATE orders SET status = 'refunded' WHERE order_id = %s", (order_id,))
        conn.commit()
    return {"order_id": order_id, "refunded_amount": amount, "status": "refunded"}


@mcp.tool(annotations={"needs_approval": True})
def cancel_order(order_id: str) -> dict:
    """Cancel an order. Requires human approval before execution."""
    with psycopg.connect(settings.database_url) as conn, conn.cursor() as cur:
        cur.execute("UPDATE orders SET status = 'cancelled' WHERE order_id = %s", (order_id,))
        conn.commit()
    return {"order_id": order_id, "status": "cancelled"}


if __name__ == "__main__":
    mcp.run(transport="stdio")

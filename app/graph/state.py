from typing import TypedDict, Optional


class SupportState(TypedDict, total=False):
    customer_id: str
    message: str
    context: list[dict]
    draft: str
    grounded: bool
    action: Optional[dict]
    approved: Optional[bool]

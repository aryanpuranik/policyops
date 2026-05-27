from pydantic import BaseModel


class ReviewDecision(BaseModel):
    decision: str  # approved | rejected | modified
    notes: str = ""
    modified_data: dict = {}

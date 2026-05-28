from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class RecordResponse(BaseModel):
    record_id           : str
    user_id             : str     = ""
    filename            : str     = ""
    prediction          : str     = "Pending"
    confidence_score    : float   = 0.0
    status              : str     = "Uploaded"
    heatmap_url         : str     = ""
    uploader_username   : str     = ""   # populated for admin view
    created_at          : datetime

    class Config:
        from_attributes = True

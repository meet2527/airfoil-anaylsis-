from typing import List, Optional
from pydantic import BaseModel, Field

class PolarPoint(BaseModel):
    alpha: float
    CL: float
    CD: float
    CDp: Optional[float] = None
    Cm: Optional[float] = None
    Top_Xtr: Optional[float] = None
    Bot_Xtr: Optional[float] = None
    Cpmin: Optional[float] = None
    Chinge: Optional[float] = None
    XCp: Optional[float] = None

class FileMetadata(BaseModel):
    filename: str
    airfoil_name: str = "Unknown"
    reynolds_num: Optional[float] = None
    mach_num: Optional[float] = None
    ncrit: Optional[float] = None

class AnalysisResult(BaseModel):
    CL_max: float
    alpha_stall: float
    CD_min: float
    alpha_CD_min: float
    LD_max: float
    alpha_LD_max: float
    alpha_zero_lift: Optional[float] = None
    CL_alpha: Optional[float] = None
    CL_alpha_deg: Optional[float] = None
    Cm_zero_lift: Optional[float] = None
    Cm_alpha: Optional[float] = None
    CD0: Optional[float] = None
    oswald_e: Optional[float] = None
    stall_idx: int

class PolarResponse(BaseModel):
    metadata: FileMetadata
    data: List[PolarPoint]
    analysis: AnalysisResult

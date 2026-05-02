from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from backend.parsers import parse_file
from backend.analysis import analyze_polar
from backend.models import PolarResponse
import traceback

app = FastAPI(title="Airfoil Analysis API")

# Allow CORS for local frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health_check():
    return {"status": "ok"}

@app.post("/api/upload", response_model=PolarResponse)
async def upload_file(file: UploadFile = File(...)):
    try:
        content = await file.read()
        metadata, points = parse_file(content, file.filename)
        
        if not points:
            raise HTTPException(status_code=400, detail="No valid data points found in file")
            
        analysis_result = analyze_polar(points)
        
        return PolarResponse(
            metadata=metadata,
            data=points,
            analysis=analysis_result
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=f"Error parsing file: {str(e)}")

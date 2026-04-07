from fastapi import APIRouter, HTTPException, Depends
from app.api.deps import get_job_queue

router = APIRouter(prefix="/jobs")


@router.get("/{job_id}")
def get_job_status(job_id: str, job_queue=Depends(get_job_queue)):
    status = job_queue.get_status(job_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return status

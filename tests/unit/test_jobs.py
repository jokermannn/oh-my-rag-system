import asyncio
import pytest
from app.jobs.queue import AsyncJobQueue, JobStatus


@pytest.mark.asyncio
async def test_submit_job_returns_id():
    queue = AsyncJobQueue()

    async def noop():
        pass

    job_id = await queue.submit(noop())
    assert job_id is not None


@pytest.mark.asyncio
async def test_completed_job_status():
    queue = AsyncJobQueue()
    results = []

    async def task():
        results.append(1)

    job_id = await queue.submit(task())
    await asyncio.sleep(0.05)
    status = queue.get_status(job_id)
    assert status.status == "completed"
    assert results == [1]


@pytest.mark.asyncio
async def test_failed_job_status():
    queue = AsyncJobQueue()

    async def failing():
        raise ValueError("intentional error")

    job_id = await queue.submit(failing())
    await asyncio.sleep(0.05)
    status = queue.get_status(job_id)
    assert status.status == "failed"
    assert "intentional error" in status.error


def test_get_unknown_job_returns_none():
    queue = AsyncJobQueue()
    assert queue.get_status("unknown-id") is None

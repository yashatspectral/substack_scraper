"""
FastAPI service that orchestrates the Rust Substack scraper and generates a
style prompt using OpenAI's API.
"""
from __future__ import annotations

import asyncio
import os
import re
import subprocess
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import List
from urllib.parse import urlparse

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, HttpUrl
from openai import OpenAI

load_dotenv(override=True)

REPO_ROOT = Path(__file__).resolve().parent.parent
BLOG_ROOT = REPO_ROOT / "blogs"


class StyleProfileRequest(BaseModel):
    substack_url: HttpUrl = Field(..., description="Root URL of the Substack to profile")
    max_posts: int = Field(5, ge=1, le=15)
    max_chars_per_post: int = Field(2000, ge=500, le=8000)
    model: str = Field(
        "gpt-4o-mini",
        description="OpenAI model to use for prompt generation"
    )
    temperature: float = Field(0.7, ge=0.0, le=1.5)


class StyleProfileResponse(BaseModel):
    style_prompt: str
    metrics: dict
    samples_used: List[str]


@dataclass
class PostSample:
    title: str
    text: str
    path: Path


app = FastAPI(title="StyleGen Prototype", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz")
async def healthcheck() -> dict:
    """Lightweight health endpoint."""
    return {"status": "ok"}


@app.post("/profile", response_model=StyleProfileResponse)
async def create_style_profile(request: StyleProfileRequest) -> StyleProfileResponse:
    """Scrape a Substack and analyze its style using OpenAI."""
    ensure_openai_key()

    parsed = urlparse(str(request.substack_url))
    if not parsed.scheme.startswith("http"):
        raise HTTPException(status_code=400, detail="URL must start with http or https")

    host = parsed.netloc
    if not host:
        raise HTTPException(status_code=400, detail="Could not determine host from URL")

    await asyncio.to_thread(run_scraper, str(request.substack_url))

    samples = await asyncio.to_thread(
        collect_samples, host, request.max_posts, request.max_chars_per_post
    )
    if not samples:
        raise HTTPException(
            status_code=404,
            detail=f"No posts found under blogs/{host}. Did the scrape succeed?",
        )

    metrics = summarize_corpus(samples)

    style_prompt = await asyncio.to_thread(
        generate_style_prompt,
        host,
        samples,
        metrics,
        request.model,
        request.temperature,
    )

    return StyleProfileResponse(
        style_prompt=style_prompt,
        metrics=metrics,
        samples_used=[str(sample.path.relative_to(BLOG_ROOT)) for sample in samples],
    )


def run_scraper(substack_url: str) -> None:
    """Execute the Rust scraper for the given Substack URL."""
    cmd = ["cargo", "run", "--release", "--", "-w", substack_url]
    try:
        subprocess.run(
            cmd,
            cwd=REPO_ROOT,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
    except subprocess.CalledProcessError as exc:
        detail = exc.stderr.decode("utf-8", errors="ignore") or exc.stdout.decode(
            "utf-8", errors="ignore"
        )
        raise HTTPException(
            status_code=500, detail=f"Scraper failed: {detail.strip()}"
        ) from exc


def collect_samples(host: str, max_posts: int, max_chars: int) -> List[PostSample]:
    """Gather recent posts scraped by the Rust tool."""
    blog_dir = BLOG_ROOT / host
    if not blog_dir.exists():
        return []

    files = sorted(
        (path for path in blog_dir.rglob("*") if path.is_file()),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    samples: List[PostSample] = []

    for path in files:
        try:
            content = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        snippet = sanitize_text(content, max_chars)
        if not snippet.strip():
            continue
        title = path.name.replace("-", " ").title()
        samples.append(PostSample(title=title, text=snippet, path=path))
        if len(samples) >= max_posts:
            break
    return samples


def sanitize_text(text: str, max_chars: int) -> str:
    """Trim whitespace and clamp the text to a maximum character count."""
    condensed = re.sub(r"\s+", " ", text).strip()
    if len(condensed) <= max_chars:
        return condensed
    return condensed[: max_chars - 3].rstrip() + "..."


def summarize_corpus(samples: List[PostSample]) -> dict:
    """Generate lightweight heuristics about the scraped corpus."""
    combined_text = " ".join(sample.text for sample in samples)
    sentences = re.split(r"[.!?]+", combined_text)
    sentences = [s.strip() for s in sentences if s.strip()]
    avg_sentence_length = (
        sum(len(sentence.split()) for sentence in sentences) / len(sentences)
        if sentences
        else 0.0
    )

    tokens = re.findall(r"\b[a-zA-Z']+\b", combined_text.lower())
    stopwords = {
        "the",
        "and",
        "of",
        "to",
        "in",
        "a",
        "is",
        "for",
        "on",
        "with",
        "that",
        "as",
        "it",
        "this",
        "are",
        "was",
        "be",
        "or",
        "by",
        "from",
        "an",
    }
    keywords = [
        word for word in tokens if word not in stopwords and len(word) > 3
    ]
    top_keywords = [word for word, _ in Counter(keywords).most_common(15)]

    return {
        "avg_sentence_length": round(avg_sentence_length, 2),
        "top_keywords": top_keywords,
        "sample_count": len(samples),
        "total_tokens": len(tokens),
    }


def generate_style_prompt(
    host: str,
    samples: List[PostSample],
    metrics: dict,
    model: str,
    temperature: float,
) -> str:
    """Send the corpus to OpenAI and request a style prompt."""
    client = OpenAI()
    sample_payload = "\n\n".join(
        f"### Sample {idx + 1}: {sample.title}\n{sample.text}"
        for idx, sample in enumerate(samples)
    )

    metrics_summary = "\n".join(
        f"- {key.replace('_', ' ').title()}: {value}"
        for key, value in metrics.items()
    )

    messages = [
        {
            "role": "system",
            "content": (
                "You are StyleGen, an editorial analyst. "
                "Analyze writing samples and craft a detailed prompt "
                "that enables another writer to emulate the source style."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Source publication: {host}\n\n"
                "Here are lightly cleaned excerpts from recent posts:\n"
                f"{sample_payload}\n\n"
                "Observational metrics:\n"
                f"{metrics_summary}\n\n"
                "Task: Produce an exhaustive 'write-like' prompt. "
                "Organize it into sections covering voice, tone, pacing, "
                "structure, rhetorical patterns, vocabulary, editorial rules, "
                "dos and don'ts, and a short checklist. "
                "Conclude with a short sample paragraph that demonstrates the style."
            ),
        },
    ]

    response = client.chat.completions.create(
        model=model,
        temperature=temperature,
        messages=messages,
    )

    try:
        return response.choices[0].message.content.strip()
    except (AttributeError, IndexError):
        raise HTTPException(
            status_code=502, detail="OpenAI did not return a usable response"
        )


def ensure_openai_key() -> None:
    """Validate that the OpenAI API key is present."""
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(
            status_code=500,
            detail="OPENAI_API_KEY environment variable is not set.",
        )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("stylegen_service:app", host="0.0.0.0", port=8000, reload=True)

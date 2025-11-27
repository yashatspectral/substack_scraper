"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import Image from "next/image";


interface StyleProfileResponse {
  style_prompt: string;
  metrics: Record<string, string | number | string[]>;
  samples_used: string[];
}

export default function HomePage() {
  const [substackUrl, setSubstackUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<StyleProfileResponse | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!substackUrl) {
      setError("Please paste a Substack URL.");
      return;
    }
    setLoading(true);
    setError(null);
    setResponse(null);
    try {
      const backend =
        process.env.NEXT_PUBLIC_STYLEGEN_API ?? "http://localhost:8000";
      const res = await fetch(`${backend}/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          substack_url: substackUrl,
          max_posts: 6,
          max_chars_per_post: 1800
        })
      });

      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail || "Failed to generate profile.");
      }

      const data = (await res.json()) as StyleProfileResponse;
      setResponse(data);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Unexpected error occurred."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <div>
        <section>
          <div className="px-4 py-4 ">
            <h1 className="text-4xl text-center font-bold font-sans">
              Capture the voice of your favorite Substack.
            </h1>
            <div className="flex justify-center px-4 py-4">
              <Image src="/Substack to Style Guide.png" alt="StyleGen Logo" width={800} height={600} quality={100} unoptimized={true} className="rounded-xl" />
            </div>
            <div>
            <p className="text-lg text-center font-sans">
              Paste any author&rsquo;s Substack and instantly receive a detailed
              writing brief that mirrors their tone, pacing, and editorial guidelines.
            </p>
          </div>
          </div>
          
          <div className="flex flex-col gap-4 px-4 py-4 max-w-3xl mx-auto">
            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4"
            >
              <div className="sm:flex-1 sm:min-w-0">
                <Input
                  type="url"
                  placeholder="https://author.substack.com"
                  value={substackUrl}
                  onChange={(event) => setSubstackUrl(event.target.value)}
                />
              </div>
              <Button
                type="submit"
                className="shrink-0"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating…
                  </>
                ) : (
                  "Generate"
                )}
              </Button>
            </form>
          </div>
        </section>

        <section className="w-full max-w-4xl">
          {loading && (
              <div className="rounded-3xl border border-slate-100 bg-white/80 p-8 shadow-lg">
                <div className="flex items-center gap-3 text-slate-600">
                  <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
                  <span>Scraping recent posts and distilling the voice…</span>
                </div>
              </div>
          )}

          {response && (
            <div className="flex flex-col gap-6">
              <div className="rounded-3xl border border-slate-100 bg-white/90 p-8 shadow-lg">
                <h2 className="mb-4 text-2xl font-semibold text-slate-900">
                  Style Prompt
                </h2>
                <Textarea
                  readOnly
                  value={response.style_prompt}
                  className="resize-none bg-slate-50/60 text-base leading-7 shadow-inner"
                />
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-3xl border border-slate-100 bg-white/90 p-6 shadow-lg">
                  <h3 className="mb-3 text-lg font-semibold text-slate-900">
                    Quick Metrics
                  </h3>
                  <ul className="space-y-2 text-sm text-slate-600">
                    {Object.entries(response.metrics).map(([key, value]) => (
                      <li key={key} className="flex justify-between gap-3">
                        <span className="font-medium capitalize">
                          {key.replace(/_/g, " ")}
                        </span>
                        <span className="text-right">
                          {Array.isArray(value) ? value.join(", ") : value}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-3xl border border-slate-100 bg-white/90 p-6 shadow-lg">
                  <h3 className="mb-3 text-lg font-semibold text-slate-900">
                    Samples Used
                  </h3>
                  <ul className="space-y-2 text-sm text-slate-600">
                    {response.samples_used.map((sample) => (
                      <li
                        key={sample}
                        className="rounded-full bg-slate-100 px-4 py-2 text-xs font-medium capitalize text-slate-700"
                      >
                        {sample.replace(/-/g, " ")}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

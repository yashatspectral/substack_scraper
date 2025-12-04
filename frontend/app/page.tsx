"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import Image from "next/image";
import { redirect } from 'next/navigation'
import { LogoutButton } from '@/components/logout-button'
import { createClient } from '@/lib/supabase/client'

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
  const supabase = createClient()
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))
    const { data: listener } = supabase.auth.onAuthStateChange((_, session) =>
      setEmail(session?.user?.email ?? null)
    )
    return () => listener.subscription.unsubscribe()
  }, [supabase])


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

      const { error: dbError } = await supabase.from("runs").insert([
        {
          substack_url: substackUrl
        }
      ]);

      if (dbError) {
        console.warn("Saved style profile but failed to log Supabase run:", dbError);
      }

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
    <>
      <div className="fixed inset-0 -z-10">
        <Image
          src="/login-bg-img.jpg"
          alt="login bg"
          fill
          quality={100}
          unoptimized
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/70" />
      </div>
      <main className="relative z-10">
        <div>
          <section>
            <div className="relative flex justify-between px-4 py-4">
              <p className="text-white">Hey there, {email ?? "friend"}</p>
              <LogoutButton />
            </div>
            <div className="relative px-4 py-4">
              <h1 className="text-4xl text-center font-bold font-sans">
                Capture the voice of your favorite Substack.
              </h1>
              <div>
                <p className="text-lg text-center font-sans py-4">
                  Paste any author&rsquo;s Substack and instantly receive a detailed
                  writing brief that mirrors their tone, pacing, and editorial guidelines.
                </p>
              </div>
            </div>

            <div className="relative flex flex-col gap-4 px-4 py-4 max-w-3xl mx-auto">
              <form
                onSubmit={handleSubmit}
                className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4"
              >
                <div className="sm:flex-1 sm:min-w-0">
                  <Input
                    type="url"
                    placeholder="https://author.substack.com"
                    className="text-white bg-transparent border-white placeholder:text-white focus-visible:ring-white/40"
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
                      <Loader2 className="h-4 w-4 animate-spin text-green-500" />
                      Generating…
                    </>
                  ) : (
                    "Generate"
                  )}
                </Button>
              </form>
            </div>
          </section>

          <section className="relative w-full max-w-4xl mx-auto sm:px-6 p-8">
            {loading && (
              <div className="rounded-lg sm:rounded-xl border border-white/20 bg-white/10 p-4 sm:p-6 md:p-8 shadow-lg backdrop-blur-sm">
                <div className="flex items-center gap-2 sm:gap-3 text-white/80 text-sm sm:text-base">
                  <Loader2 className="h-5 w-5 animate-spin text-green-500" />
                  <span>Scraping recent essays and distilling the voice…</span>
                </div>
              </div>
            )}

            {response && (
              <div className="w-full rounded-xl sm:rounded-2xl border border-white/20 bg-white/10 p-4 sm:p-6 md:p-8 shadow-xl backdrop-blur-sm space-y-6 sm:space-y-8">
                <div className="w-full">
                  <h2 className="mb-3 sm:mb-4 text-xl sm:text-2xl font-semibold text-white">
                    Style Prompt
                  </h2>
                  <Textarea
                    readOnly
                    value={response.style_prompt}
                    className="w-full min-h-[200px] sm:min-h-[240px] rounded-lg sm:rounded-xl bg-white/5 text-sm sm:text-base leading-6 sm:leading-7 text-white/90 p-3 sm:p-4"
                  />
                </div>

                <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
                  <div className="rounded-lg sm:rounded-xl border border-white/15 bg-white/5 p-4 sm:p-5 backdrop-blur-sm">
                    <h3 className="mb-2 sm:mb-3 text-base sm:text-lg font-semibold text-white">
                      Quick Metrics
                    </h3>
                    <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-white/80">
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

                  <div className="rounded-lg sm:rounded-xl border border-white/15 bg-white/5 p-4 sm:p-5 backdrop-blur-sm">
                    <h3 className="mb-2 sm:mb-3 text-base sm:text-lg font-semibold text-white">
                      Essays Scraped
                    </h3>
                    <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-white/80">
                      {response.samples_used.map((sample) => (
                        <li
                          key={sample}
                          className="rounded-lg bg-white/10 px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-medium capitalize text-white/90"
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
    </>
  );
}

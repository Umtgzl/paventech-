"use client";

import { useState, useTransition } from "react";
import { Bot, Loader2, Send, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { askAssistantAction } from "@/server/plus/actions";
import type { AssistantAnswer } from "@/server/plus/assistant";

const SUGGESTIONS = [
  "Bu ay en çok satan 5 ürün hangisi?",
  "Vadesi geçen alacaklar kimlerde?",
  "Stoğu azalan ürünler var mı?",
  "Son 90 günde en iyi müşterilerimiz kimler?",
  "Kasada ve bankada ne kadar paramız var?",
  "Tedarikçilere ne kadar borcumuz var?",
];

type Message = { role: "user"; text: string } | { role: "assistant"; answer: AssistantAnswer | null; suggestions?: string[] };

export function AssistantChat() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [pending, start] = useTransition();

  function ask(q: string) {
    const text = q.trim();
    if (!text || pending) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setQuestion("");
    start(async () => {
      const res = await askAssistantAction(text);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setMessages((m) => [...m, { role: "assistant", answer: res.data.answer, suggestions: res.data.suggestions }]);
    });
  }

  return (
    <Card className="min-h-[480px] gap-0 py-0">
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
        {messages.length === 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">Örnek sorular:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => ask(s)} className="rounded-full border bg-card px-3 py-1.5 text-sm hover:border-plus/40 hover:bg-plus/[0.04]">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end gap-2">
              <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground">{m.text}</div>
              <User className="mt-1.5 size-4 shrink-0 text-muted-foreground" />
            </div>
          ) : (
            <div key={i} className="flex gap-2">
              <Bot className="mt-1.5 size-4 shrink-0 text-plus" />
              <div className="min-w-0 flex-1 rounded-2xl rounded-bl-sm border bg-muted/30 px-4 py-3 text-sm">
                {m.answer ? (
                  <>
                    <p className="font-semibold">{m.answer.title}</p>
                    <p className="mt-0.5 text-muted-foreground">{m.answer.summary}</p>
                    {m.answer.rows.length > 0 && (
                      <div className="mt-3 overflow-x-auto rounded-md border bg-card">
                        <table className="w-full text-sm">
                          <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                            <tr>
                              {m.answer.columns.map((c, ci) => (
                                <th key={c} className={`px-3 py-1.5 font-medium ${ci === 0 ? "text-left" : "text-right"}`}>
                                  {c}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {m.answer.rows.map((r, ri) => (
                              <tr key={ri} className="border-b last:border-0">
                                {r.map((cell, ci) => (
                                  <td key={ci} className={`px-3 py-1.5 ${ci === 0 ? "text-left" : "text-right tabular-nums"}`}>
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <p>Bu soruyu henüz cevaplayamıyorum. Şu konularda soru sorabilirsiniz:</p>
                    <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                      {m.suggestions?.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
          ),
        )}
        {pending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Veriler inceleniyor...
          </div>
        )}
      </div>
      <CardContent className="border-t py-3">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            ask(question);
          }}
        >
          <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Örn. Bu ay en çok satan 5 ürün hangisi?" maxLength={300} />
          <Button type="submit" variant="plus" disabled={pending || question.trim().length < 3}>
            <Send /> Sor
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

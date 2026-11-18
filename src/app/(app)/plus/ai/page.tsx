import { suspensePage } from "@/components/page/suspense-page";
import { AssistantChat } from "@/components/plus/assistant-chat";
import { PlusHeader } from "@/components/plus/plus-header";
import { requireModule } from "@/server/session";

export default suspensePage(async function AiPage() {
  await requireModule("ai");
  return (
    <>
      <PlusHeader module="AI Asistan" title="AI Asistan" />
      <div className="max-w-4xl">
        <AssistantChat />
      </div>
    </>
  );
});

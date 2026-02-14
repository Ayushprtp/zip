import { getSession } from "lib/auth/server";
import { redirect } from "next/navigation";
import ChatBot from "@/components/chat-bot";
import { generateUUID } from "lib/utils";

export default async function HomePage() {
  const session = await getSession();
  if (session) {
    const id = generateUUID();
    return <ChatBot initialMessages={[]} threadId={id} key={id} />;
  } else {
    redirect("/sign-in");
  }
}

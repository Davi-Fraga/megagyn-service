import type { Metadata } from "next";
import { NotificationsList } from "@/ui/notifications-list";

export const metadata: Metadata = { title: "Notificações" };

export default function FieldNotificationsPage() {
  return <NotificationsList base="/campo" />;
}

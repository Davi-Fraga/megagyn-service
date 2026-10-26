import type { Metadata } from "next";
import { NotificationsList } from "@/ui/notifications-list";

export const metadata: Metadata = { title: "Notificações" };

export default function AdminNotificationsPage() {
  return <NotificationsList base="/admin" />;
}

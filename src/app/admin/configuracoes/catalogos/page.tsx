import { redirect } from "next/navigation";

/** As listas de escolha ficam na página de configurações. */
export default function CatalogsIndexPage() {
  redirect("/admin/configuracoes");
}

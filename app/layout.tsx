import "./globals.css";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import DebugCopy from "../components/debug-copy";
import PatientDraftForm from "../components/patient-draft-form";
import NurseAccessModal from "../components/nurse-access-modal";
import DoctorOperationsDashboard from "../components/doctor-operations-dashboard";
import NurseDirectForm from "../components/nurse-direct-form";
import QuickActions from "../components/quick-actions";
export const metadata: Metadata = { title: "RXList · Control clínico", description: "Gestión segura de enfermería por pisos" };
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { const hasSession = Boolean((await cookies()).get("rxlist_session")?.value); return <html lang="es"><body>{children}{hasSession && <a className="logout-fallback" href="/api/auth/logout">Cerrar sesión</a>}<PatientDraftForm /><NurseDirectForm /><QuickActions /><DoctorOperationsDashboard /><DebugCopy /><NurseAccessModal /></body></html>; }

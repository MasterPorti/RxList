import "./globals.css";
import type { Metadata } from "next";
import DebugCopy from "../components/debug-copy";
import PatientDraftForm from "../components/patient-draft-form";
import NurseAccessModal from "../components/nurse-access-modal";
export const metadata: Metadata = { title: "RXList · Control clínico", description: "Gestión segura de enfermería por pisos" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="es"><body>{children}<PatientDraftForm /><DebugCopy /><NurseAccessModal /></body></html>; }

"use client";
import {usePathname} from "next/navigation";
export default function ManagementLink(){const path=usePathname();if(path!=="/doctor")return null;return <a className="manual-link" href="/doctor/management">Gestión manual</a>}

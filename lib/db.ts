export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "doctor" | "nurse";
  registeredBy?: string;
  assignedFloor?: string;
}

// Client session functions (runs in browser localStorage)
const isBrowser = () => typeof window !== "undefined";

export const getSession = (): User | null => {
  if (!isBrowser()) return null;
  const session = localStorage.getItem("rx_session");
  return session ? JSON.parse(session) : null;
};

export const setSession = (user: User) => {
  if (!isBrowser()) return;
  localStorage.setItem("rx_session", JSON.stringify(user));
};

export const logoutUser = () => {
  if (!isBrowser()) return;
  localStorage.removeItem("rx_session");
};

// Helper to fetch entire DB state from server API
const fetchDB = async (): Promise<any> => {
  const response = await fetch("/api/db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "read" }),
  });
  const data = await response.json();
  if (!data.success) throw new Error(data.error || "Failed to fetch DB");
  return data.db;
};

// Helper to save DB state back to server API
const saveDB = async (db: any): Promise<void> => {
  const response = await fetch("/api/db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "write", db }),
  });
  const data = await response.json();
  if (!data.success) throw new Error(data.error || "Failed to write DB");
};

// Unified Authentication (Admin & Doctor & Nurse)
export const loginUser = async (email: string, password: string): Promise<User | string> => {
  try {
    // 1. Check Admin Credentials first (hardcoded)
    if (email.toLowerCase() === "admin@rxlist.com" && password === "admin123") {
      const adminUser: User = {
        id: "admin_01",
        name: "Administrador RxList",
        email: "admin@rxlist.com",
        role: "admin",
      };
      setSession(adminUser);
      return adminUser;
    }

    // 2. Otherwise, look up Doctor/Nurse in local DB
    const db = await fetchDB();
    const foundUser = db.users.find(
      (u: any) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );

    if (!foundUser) {
      return "Credenciales incorrectas o el usuario no existe.";
    }

    const sessionUser: User = {
      id: foundUser.id,
      name: foundUser.name,
      email: foundUser.email,
      role: foundUser.role, // admin, doctor, or nurse
      registeredBy: foundUser.registeredBy,
      assignedFloor: foundUser.assignedFloor,
    };
    
    setSession(sessionUser);
    return sessionUser;
  } catch (err: any) {
    return `Error de conexión: ${err.message}`;
  }
};

// Register Doctor (Admin Only)
export const registerDoctor = async (name: string, email: string, password: string): Promise<User | string> => {
  try {
    const db = await fetchDB();
    
    // Check if email already registered (case insensitive)
    const emailExists = db.users.some(
      (u: any) => u.email.toLowerCase() === email.toLowerCase() || email.toLowerCase() === "admin@rxlist.com"
    );
    if (emailExists) {
      return "El correo electrónico ya está registrado.";
    }

    const newDoctor = {
      id: "doc_" + Math.random().toString(36).substr(2, 9),
      name,
      email,
      password,
      role: "doctor" as const,
    };

    db.users.push(newDoctor);
    await saveDB(db);

    const docUser: User = {
      id: newDoctor.id,
      name: newDoctor.name,
      email: newDoctor.email,
      role: "doctor",
    };
    return docUser;
  } catch (err: any) {
    return `Error al registrar médico: ${err.message}`;
  }
};

// Update Doctor (Admin Only)
export const updateDoctor = async (
  doctorId: string,
  name: string,
  email: string,
  password?: string
): Promise<User | string> => {
  try {
    const db = await fetchDB();
    const docIndex = db.users.findIndex((u: any) => u.id === doctorId && u.role === "doctor");
    if (docIndex === -1) {
      return "Médico no encontrado.";
    }

    // Check if email already registered by another user (case insensitive)
    const emailExists = db.users.some(
      (u: any) => u.id !== doctorId && (u.email.toLowerCase() === email.toLowerCase() || email.toLowerCase() === "admin@rxlist.com")
    );
    if (emailExists) {
      return "El correo electrónico ya está registrado por otro usuario.";
    }

    db.users[docIndex].name = name;
    db.users[docIndex].email = email;
    if (password) {
      db.users[docIndex].password = password;
    }

    await saveDB(db);

    const docUser: User = {
      id: db.users[docIndex].id,
      name: db.users[docIndex].name,
      email: db.users[docIndex].email,
      role: "doctor",
    };
    return docUser;
  } catch (err: any) {
    return `Error al actualizar médico: ${err.message}`;
  }
};

// Get list of registered Doctors (Admin Only)
export const getDoctors = async (): Promise<User[]> => {
  try {
    const db = await fetchDB();
    return db.users
      .filter((u: any) => u.role === "doctor")
      .map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: "doctor",
      }));
  } catch {
    return [];
  }
};

// Register Nurse (Doctor Only)
export const registerNurse = async (
  name: string,
  email: string,
  password: string,
  doctorId: string
): Promise<User | string> => {
  try {
    const db = await fetchDB();

    // Check if email already registered
    const emailExists = db.users.some(
      (u: any) => u.email.toLowerCase() === email.toLowerCase() || email.toLowerCase() === "admin@rxlist.com"
    );
    if (emailExists) {
      return "El correo electrónico ya está registrado.";
    }

    const newNurse = {
      id: "nurse_" + Math.random().toString(36).substr(2, 9),
      name,
      email,
      password,
      role: "nurse" as const,
      registeredBy: doctorId,
      assignedFloor: "Sin asignar",
    };

    db.users.push(newNurse);
    await saveDB(db);

    const nurseUser: User = {
      id: newNurse.id,
      name: newNurse.name,
      email: newNurse.email,
      role: "nurse",
      registeredBy: doctorId,
      assignedFloor: "Sin asignar",
    };
    return nurseUser;
  } catch (err: any) {
    return `Error al registrar enfermera: ${err.message}`;
  }
};

// Update Nurse (Doctor Only)
export const updateNurse = async (
  nurseId: string,
  name: string,
  email: string,
  password?: string
): Promise<User | string> => {
  try {
    const db = await fetchDB();
    const index = db.users.findIndex((u: any) => u.id === nurseId && u.role === "nurse");
    if (index === -1) {
      return "Enfermera no encontrada.";
    }

    // Check if email already registered by another user (case insensitive)
    const emailExists = db.users.some(
      (u: any) => u.id !== nurseId && (u.email.toLowerCase() === email.toLowerCase() || email.toLowerCase() === "admin@rxlist.com")
    );
    if (emailExists) {
      return "El correo electrónico ya está registrado por otro usuario.";
    }

    db.users[index].name = name;
    db.users[index].email = email;
    if (password) {
      db.users[index].password = password;
    }

    await saveDB(db);

    const nurseUser: User = {
      id: db.users[index].id,
      name: db.users[index].name,
      email: db.users[index].email,
      role: "nurse",
      registeredBy: db.users[index].registeredBy,
      assignedFloor: db.users[index].assignedFloor,
    };
    return nurseUser;
  } catch (err: any) {
    return `Error al actualizar enfermera: ${err.message}`;
  }
};

// Get list of Nurses registered by Doctor
export const getDoctorNurses = async (doctorId: string): Promise<User[]> => {
  try {
    const db = await fetchDB();
    return db.users
      .filter((u: any) => u.role === "nurse" && u.registeredBy === doctorId)
      .map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: "nurse",
        registeredBy: u.registeredBy,
        assignedFloor: u.assignedFloor || "Sin asignar",
      }));
  } catch {
    return [];
  }
};

// Assign Nurse to Floor (Doctor Only)
export const assignNurseToFloor = async (nurseId: string, floor: string): Promise<User | string> => {
  try {
    const db = await fetchDB();
    const index = db.users.findIndex((u: any) => u.id === nurseId && u.role === "nurse");
    if (index === -1) {
      return "Enfermera no encontrada.";
    }

    db.users[index].assignedFloor = floor;
    await saveDB(db);

    const nurseUser: User = {
      id: db.users[index].id,
      name: db.users[index].name,
      email: db.users[index].email,
      role: "nurse",
      registeredBy: db.users[index].registeredBy,
      assignedFloor: db.users[index].assignedFloor,
    };
    return nurseUser;
  } catch (err: any) {
    return `Error al asignar piso: ${err.message}`;
  }
};

export const db = {
  "users": [
    {
      "id": "doc1",
      "name": "Dr. Carlos Ochoa",
      "email": "doctor@hospital.mx",
      "password": "password123",
      "role": "doctor"
    },
    {
      "id": "nurse1",
      "name": "Enf. Laura Gómez",
      "email": "enfermera1@hospital.mx",
      "password": "enfermera1@hospital.mx",
      "role": "nurse",
      "registeredBy": "doc1",
      "assignedFloor": "Piso 1 - Cardiología"
    },
    {
      "id": "nurse2",
      "name": "Enf. Sofía Montes",
      "email": "enfermera2@hospital.mx",
      "password": "password123",
      "role": "nurse",
      "registeredBy": "doc1",
      "assignedFloor": "Piso 2 - Pediatría"
    },
    {
      "id": "nurse_56567aj7n",
      "name": "Maria",
      "email": "maria@correo.com",
      "password": "maria@correo.com",
      "role": "nurse",
      "registeredBy": "doc1",
      "assignedFloor": "Piso 1 - Cardiología"
    }
  ],
  "groups": [
    {
      "id": "g1",
      "name": "Urgencias Pediatría",
      "createdBy": "doc1",
      "nurses": [
        "nurse1"
      ]
    },
    {
      "id": "g_q8pv5mgvy",
      "name": "Piso 4",
      "createdBy": "doc1",
      "nurses": [
        "nurse2",
        "nurse1",
        "nurse_56567aj7n"
      ]
    }
  ],
  "prescriptions": [
    {
      "id": "rx1",
      "patientName": "María Elena Gómez",
      "date": "2026-06-15",
      "rawText": "Metformina 850mg 1 tab c/12h con alimentos. Enalapril 10mg 1 tab c/24h por la mañana.",
      "status": "active",
      "scannedBy": "nurse1",
      "sharedWithGroups": [
        "g1"
      ],
      "medications": [
        {
          "id": "m1",
          "name": "Metformina",
          "dosage": "850mg",
          "frequency": "Cada 12 horas",
          "duration": "Continuo",
          "interactionAlert": "Tomar con alimentos para evitar malestar estomacal.",
          "completed": false
        },
        {
          "id": "m2",
          "name": "Enalapril",
          "dosage": "10mg",
          "frequency": "Cada 24 horas (Mañana)",
          "duration": "Continuo",
          "interactionAlert": "Monitorear presión arterial regularmente.",
          "completed": true
        }
      ]
    }
  ]
};

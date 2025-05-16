const API_BASE = "http://localhost:8000";

export async function createUser(data: {
    username: string;
    password: string;
    email: string;
    role?: string;
}) {
    const res = await fetch(`${API_BASE}/admin/create_user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    return res.json();
}

export async function login(username: string, password: string) {
    const params = new URLSearchParams({ username, password });
    const res = await fetch(`${API_BASE}/login?${params.toString()}`, {
        method: "POST",
    });
    return res.json();
}

export async function modifyUserInfo(username: string, data: {
    password?: string;
    role?: string;
    is_active?: boolean;
}) {
    const res = await fetch(`${API_BASE}/admin/modify_user_info/${username}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    return res.json();
}

export async function getUserInfo(username: string) {
    const res = await fetch(`${API_BASE}/get_user_info/${username}`);
    return res.json();
}

export async function getAllUsers() {
    const res = await fetch(`${API_BASE}/admin/get_all_users`);
    return res.json();
}

export async function deleteUser(username: string) {
    const res = await fetch(`${API_BASE}/admin/delete_user/${username}`, {
        method: "DELETE",
    });
    return res.json();
}

export async function getParkingConfig() {
    const res = await fetch(`${API_BASE}/admin/get_parking_config`);
    return res.json();
}

export async function updateParkingConfig(id: number, data: {
    vehicle_type?: string;
    max_capacity?: number;
    price_per_hour?: number;
}) {
    const res = await fetch(`${API_BASE}/admin/update_parking_config/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    return res.json();
}

export async function deleteParkingConfig(id: number) {
    const res = await fetch(`${API_BASE}/admin/delete_parking_config/${id}`, {
        method: "DELETE",
    });
    return res.json();
}

export async function createParkingConfig(data: {
    id: number;
    vehicle_type: string;
    max_capacity: number;
    price_per_hour: number;
}) {
    const params = new URLSearchParams({
        id: data.id.toString(),
        vehicle_type: data.vehicle_type,
        max_capacity: data.max_capacity.toString(),
        price_per_hour: data.price_per_hour.toString(),
    });
    const res = await fetch(`${API_BASE}/admin/create_parking_config?${params.toString()}`, {
        method: "POST",
    });
    return res.json();
}

export async function autoCheck(license_plate: string) {
    const res = await fetch(`${API_BASE}/auto_check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ license_plate }),
    });
    return res.json();
}

export async function getParkingSession(license_plate: string) {
    const res = await fetch(`${API_BASE}/get_parking_session/${license_plate}`);
    return res.json();
}

export async function getAllParkingSessions() {
    const res = await fetch(`${API_BASE}/get_all_parking_sessions`);
    return res.json();
}

export async function updateParkingSession(license_plate: string, data: {
    status?: string;
    timeout?: string;
}) {
    const res = await fetch(`${API_BASE}/update_parking_session/${license_plate}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    return res.json();
}

export async function deleteParkingSession(id: number) {
    const res = await fetch(`${API_BASE}/delete_parking_session/${id}`, {
        method: "DELETE",
    });
    return res.json();
}

"use server";

import fs from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";

// Type Definition
// Type Definition
export type RedevelopmentProject = {
    id: string;
    station_name: string;
    project_name: string;
    search_keyword: string;
    category?: string;
    schedule: string;
    description: string;
    impact_level: number;
    is_future: boolean;
    createdAt: string;
    approvedAt?: string;
};

const PENDING_FILE = path.join(process.cwd(), "data", "redevelopment_pending.json");
const MASTER_FILE = path.join(process.cwd(), "data", "redevelopment_master.json");

// Helper to read data
async function readData(filePath: string): Promise<RedevelopmentProject[]> {
    try {
        const data = await fs.readFile(filePath, "utf-8");
        return JSON.parse(data);
    } catch (error) {
        // File might not exist yet or is empty
        return [];
    }
}

// Helper to write data
async function writeData(filePath: string, data: RedevelopmentProject[]) {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

export async function getPendingProjects() {
    const data = await readData(PENDING_FILE);
    // Sort by createdAt ASC (Oldest First)
    return data.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export async function approveRedevelopment(id: string) {
    try {
        // 1. Read Pending Data
        const pending = await readData(PENDING_FILE);
        const projectIndex = pending.findIndex((p) => p.id === id);

        if (projectIndex === -1) {
            throw new Error(`Project with ID ${id} not found.`);
        }

        const project = pending[projectIndex];

        // 2. Read Master Data
        const master = await readData(MASTER_FILE);

        // 3. Move Data: Add Timestamp and Push to Master
        const approvedProject = {
            ...project,
            approvedAt: new Date().toISOString(),
        };
        master.push(approvedProject);

        // 4. Write Master Data
        await writeData(MASTER_FILE, master);

        // 5. Cleanup: Remove from Pending
        const newPending = pending.filter((p) => p.id !== id);
        await writeData(PENDING_FILE, newPending);

        // 6. Revalidate
        revalidatePath("/admin/redevelopment");
        return { success: true, message: "Project approved successfully." };
    } catch (error) {
        console.error("Approval Error:", error);
        return { success: false, message: "Failed to approve project." };
    }
}

export async function rejectRedevelopment(id: string) {
    try {
        // 1. Read Pending Data
        const pending = await readData(PENDING_FILE);
        const initialLength = pending.length;

        // 2. Remove Project
        const newPending = pending.filter((p) => p.id !== id);

        if (newPending.length === initialLength) {
            throw new Error(`Project with ID ${id} not found.`);
        }

        // 3. Write Pending Data
        await writeData(PENDING_FILE, newPending);

        // 4. Revalidate
        revalidatePath("/admin/redevelopment");
        return { success: true, message: "Project rejected (deleted) successfully." };
    } catch (error) {
        console.error("Rejection Error:", error);
        return { success: false, message: "Failed to reject project." };
    }
}

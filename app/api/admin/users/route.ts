import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getSessionUser, isAdmin, hashPassword } from "@/lib/auth";
import {
  getAllUsersForAdmin,
  findUserByEmail,
  createUser,
  updateUserRole,
  deleteUserById,
} from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const adminUser = await getSessionUser(req);
  if (!adminUser || !isAdmin(adminUser)) {
    return NextResponse.json(
      { error: "Akses ditolak: Hanya Administrator yang diizinkan mengelola pengguna." },
      { status: 403 }
    );
  }

  const users = getAllUsersForAdmin();
  return NextResponse.json({
    success: true,
    users,
  });
}

export async function PATCH(req: Request) {
  const adminUser = await getSessionUser(req);
  if (!adminUser || !isAdmin(adminUser)) {
    return NextResponse.json(
      { error: "Akses ditolak: Hanya Administrator yang diizinkan mengubah peran pengguna." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { userId, role } = body as { userId?: string; role?: string };

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "userId wajib disertakan." }, { status: 400 });
    }

    const validRoles = ["USER", "MENTOR", "ADMIN"];
    if (!role || !validRoles.includes(role)) {
      return NextResponse.json(
        { error: "Peran harus berupa USER, MENTOR, atau ADMIN." },
        { status: 400 }
      );
    }

    updateUserRole(userId, role, {
      adminId: adminUser.id,
      adminEmail: adminUser.email,
    });

    return NextResponse.json({
      success: true,
      message: `Peran pengguna berhasil diubah menjadi ${role}.`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal mengubah peran pengguna.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function POST(req: Request) {
  const adminUser = await getSessionUser(req);
  if (!adminUser || !isAdmin(adminUser)) {
    return NextResponse.json(
      { error: "Akses ditolak: Hanya Administrator yang diizinkan mendaftarkan pengguna langsung." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { name, email, password, role } = body as {
      name?: string;
      email?: string;
      password?: string;
      role?: string;
    };

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Nama, email, dan kata sandi awal wajib diisi." },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail.includes("@")) {
      return NextResponse.json({ error: "Format email tidak valid." }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Kata sandi minimal 6 karakter." }, { status: 400 });
    }

    const validRoles = ["USER", "MENTOR", "ADMIN"];
    const targetRole = role && validRoles.includes(role) ? role : "MENTOR";

    const existing = findUserByEmail(cleanEmail);
    if (existing) {
      return NextResponse.json(
        { error: `Email "${cleanEmail}" sudah terdaftar.` },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const id = crypto.randomUUID();

    const newUser = createUser({
      id,
      email: cleanEmail,
      name: name.slice(0, 80),
      passwordHash,
      role: targetRole,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        created_at: newUser.created_at,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal membuat pengguna.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const adminUser = await getSessionUser(req);
  if (!adminUser || !isAdmin(adminUser)) {
    return NextResponse.json(
      { error: "Akses ditolak: Hanya Administrator yang diizinkan menghapus pengguna." },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Parameter id wajib disertakan." }, { status: 400 });
    }

    deleteUserById(id, {
      adminId: adminUser.id,
      adminEmail: adminUser.email,
    });

    return NextResponse.json({
      success: true,
      message: "Akun pengguna berhasil dihapus.",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gagal menghapus pengguna.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}


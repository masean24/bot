import { supabase } from "./supabase.js";

export interface ChatSession {
    id: string;
    user_id: number;
    username: string | null;
    admin_id: number | null;
    status: "open" | "closed";
    created_at: string;
    closed_at: string | null;
}

export interface ChatMessage {
    id: string;
    session_id: string;
    sender_type: "user" | "admin";
    sender_id: number;
    message: string;
    created_at: string;
}

/**
 * Get active chat session for a user
 */
export async function getActiveSession(userId: number): Promise<ChatSession | null> {
    const { data, error } = await supabase
        .from("chat_sessions")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

    if (error || !data) return null;
    return data as ChatSession;
}

/**
 * Create a new chat session
 */
export async function createSession(userId: number, username?: string): Promise<ChatSession> {
    // Close any existing open sessions
    await supabase
        .from("chat_sessions")
        .update({ status: "closed", closed_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("status", "open");

    const { data, error } = await supabase
        .from("chat_sessions")
        .insert({
            user_id: userId,
            username: username || null,
            status: "open",
        })
        .select()
        .single();

    if (error) throw error;
    return data as ChatSession;
}

/**
 * Close a chat session
 */
export async function closeSession(sessionId: string): Promise<void> {
    await supabase
        .from("chat_sessions")
        .update({ status: "closed", closed_at: new Date().toISOString() })
        .eq("id", sessionId);
}

/**
 * Get all open chat sessions (for admin)
 */
export async function getOpenSessions(): Promise<ChatSession[]> {
    const { data, error } = await supabase
        .from("chat_sessions")
        .select("*")
        .eq("status", "open")
        .order("created_at", { ascending: false });

    if (error) return [];
    return (data || []) as ChatSession[];
}

/**
 * Get session by ID
 */
export async function getSessionById(sessionId: string): Promise<ChatSession | null> {
    const { data, error } = await supabase
        .from("chat_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

    if (error || !data) return null;
    return data as ChatSession;
}

/**
 * Assign admin to a session
 */
export async function assignAdmin(sessionId: string, adminId: number): Promise<void> {
    await supabase
        .from("chat_sessions")
        .update({ admin_id: adminId })
        .eq("id", sessionId);
}

/**
 * Send a message in a chat session
 */
export async function sendMessage(
    sessionId: string,
    senderId: number,
    senderType: "user" | "admin",
    message: string
): Promise<ChatMessage> {
    const { data, error } = await supabase
        .from("chat_messages")
        .insert({
            session_id: sessionId,
            sender_id: senderId,
            sender_type: senderType,
            message,
        })
        .select()
        .single();

    if (error) throw error;
    return data as ChatMessage;
}

/**
 * Get messages for a session
 */
export async function getSessionMessages(sessionId: string, limit = 20): Promise<ChatMessage[]> {
    const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true })
        .limit(limit);

    if (error) return [];
    return (data || []) as ChatMessage[];
}

/**
 * Get last message of a session (for preview)
 */
export async function getLastMessage(sessionId: string): Promise<ChatMessage | null> {
    const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

    if (error || !data) return null;
    return data as ChatMessage;
}

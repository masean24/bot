import { Router } from "express";
import jwt from "jsonwebtoken";
import {
    getActiveProducts,
    getProductById,
    getProductStock,
    createProduct,
    updateProduct,
    getRecentOrders,
    getOrderStats,
    addCredentials,
    supabase,
} from "../../services/supabase.js";
import { ADMIN_USERNAME, ADMIN_PASSWORD, JWT_SECRET } from "../../config.js";

const router = Router();

// JWT auth middleware
const authMiddleware = (req: any, res: any, next: any) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: "Unauthorized - No token provided" });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ error: "Unauthorized - Invalid token" });
    }
};

// Login endpoint
router.post("/login", (req, res) => {
    const { username, password } = req.body;

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        const token = jwt.sign(
            { username, role: "admin" },
            JWT_SECRET,
            { expiresIn: "7d" }
        );
        res.json({ token, message: "Login successful" });
    } else {
        res.status(401).json({ error: "Invalid username or password" });
    }
});

// Verify token endpoint
router.get("/verify", authMiddleware, (req: any, res) => {
    res.json({ valid: true, user: req.user });
});

// ============ PRODUCTS ============

// Get all products
router.get("/products", authMiddleware, async (req, res) => {
    try {
        const { data: products, error } = await supabase
            .from("products")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) throw error;

        // Add stock count to each product
        const productsWithStock = await Promise.all(
            (products || []).map(async (product) => ({
                ...product,
                stock: await getProductStock(product.id),
            }))
        );

        res.json(productsWithStock);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Get single product
router.get("/products/:id", authMiddleware, async (req, res) => {
    try {
        const product = await getProductById(req.params.id);
        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }
        const stock = await getProductStock(product.id);
        res.json({ ...product, stock });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Create product
router.post("/products", authMiddleware, async (req, res) => {
    try {
        const { name, description, price, is_active } = req.body;

        if (!name || !price) {
            return res.status(400).json({ error: "Name and price are required" });
        }

        const product = await createProduct({
            name,
            description: description || "",
            price: parseInt(price),
            is_active: is_active !== false,
        });

        res.status(201).json(product);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Update product
router.put("/products/:id", authMiddleware, async (req, res) => {
    try {
        const { name, description, price, is_active } = req.body;
        const updates: any = {};

        if (name !== undefined) updates.name = name;
        if (description !== undefined) updates.description = description;
        if (price !== undefined) updates.price = parseInt(price);
        if (is_active !== undefined) updates.is_active = is_active;

        const product = await updateProduct(req.params.id, updates);
        res.json(product);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Delete product (soft delete by setting is_active = false)
router.delete("/products/:id", authMiddleware, async (req, res) => {
    try {
        await updateProduct(req.params.id, { is_active: false });
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ============ CREDENTIALS ============

// Get credentials for a product
router.get("/products/:id/credentials", authMiddleware, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("credentials")
            .select("*")
            .eq("product_id", req.params.id)
            .order("is_sold", { ascending: true })
            .order("created_at", { ascending: false });

        if (error) throw error;
        res.json(data || []);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Add credentials to product
router.post("/products/:id/credentials", authMiddleware, async (req, res) => {
    try {
        const { credentials } = req.body;

        if (!credentials || !Array.isArray(credentials)) {
            return res.status(400).json({ error: "Credentials array is required" });
        }

        const toInsert = credentials.map((c: any) => ({
            product_id: req.params.id,
            email: c.email,
            password: c.password,
            pin: c.pin || null,
            extra_info: c.extra_info || null,
        }));

        const added = await addCredentials(toInsert);
        res.status(201).json(added);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Delete credential
router.delete("/credentials/:id", authMiddleware, async (req, res) => {
    try {
        const { error } = await supabase
            .from("credentials")
            .delete()
            .eq("id", req.params.id)
            .eq("is_sold", false); // Only delete unsold credentials

        if (error) throw error;
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ============ ORDERS ============

// Get orders with pagination
router.get("/orders", authMiddleware, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit as string) || 20;
        const offset = parseInt(req.query.offset as string) || 0;
        const status = req.query.status as string;

        let query = supabase
            .from("orders")
            .select("*, products(name)")
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1);

        if (status) {
            query = query.eq("status", status);
        }

        const { data, error } = await query;
        if (error) throw error;

        res.json(data || []);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Get order details with credentials
router.get("/orders/:id", authMiddleware, async (req, res) => {
    try {
        const { data: order, error } = await supabase
            .from("orders")
            .select("*, products(name)")
            .eq("id", req.params.id)
            .single();

        if (error) throw error;

        const { data: credentials } = await supabase
            .from("credentials")
            .select("*")
            .eq("order_id", req.params.id);

        res.json({ ...order, credentials: credentials || [] });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ============ STATS ============

router.get("/stats", authMiddleware, async (req, res) => {
    try {
        const stats = await getOrderStats();

        // Get product count
        const { count: productCount } = await supabase
            .from("products")
            .select("*", { count: "exact", head: true })
            .eq("is_active", true);

        // Get total stock
        const { count: stockCount } = await supabase
            .from("credentials")
            .select("*", { count: "exact", head: true })
            .eq("is_sold", false);

        res.json({
            ...stats,
            productCount: productCount || 0,
            stockCount: stockCount || 0,
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;

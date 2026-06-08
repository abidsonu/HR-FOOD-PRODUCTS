require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const app = express();

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "HRFOODPRODUCTS2026";

app.use(cors());
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// ====================
// AUTH MIDDLEWARE
// ====================

function verifyToken(req, res, next){

    const authHeader = req.headers.authorization;

    if(!authHeader){
        return res.status(401).json({
            message:"Login required"
        });
    }

    const token = authHeader.split(" ")[1];

    if(!token){
        return res.status(401).json({
            message:"Token missing"
        });
    }

    jwt.verify(token, JWT_SECRET, (err, user)=>{

        if(err){
            return res.status(403).json({
                message:"Invalid or expired login"
            });
        }

        req.user = user;
        next();
    });
}

function allowRoles(...roles){

    return (req, res, next)=>{

        if(!req.user || !roles.includes(req.user.role)){
            return res.status(403).json({
                message:"Access denied. You do not have permission."
            });
        }

        next();
    };
}

// ====================
// INIT DATABASE
// ====================

async function initDatabase(){

    await pool.query(`
        CREATE TABLE IF NOT EXISTS products (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            barcode TEXT,
            category TEXT,
            "buyPrice" NUMERIC,
            "sellPrice" NUMERIC,
            stock INTEGER DEFAULT 0,
            "minStock" INTEGER DEFAULT 10
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS sales (
            id SERIAL PRIMARY KEY,
            "productId" INTEGER,
            "productName" TEXT,
            quantity INTEGER,
            amount NUMERIC,
            "saleDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS restocks (
            id SERIAL PRIMARY KEY,
            "productId" INTEGER,
            "productName" TEXT,
            quantity INTEGER,
            supplier TEXT,
            cost NUMERIC,
            "restockDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT UNIQUE,
            password TEXT,
            role TEXT DEFAULT 'staff'
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS bills (
            id SERIAL PRIMARY KEY,
            "billNo" TEXT,
            "totalAmount" NUMERIC,
            "billDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS bill_items (
            id SERIAL PRIMARY KEY,
            "billId" INTEGER,
            "productId" INTEGER,
            "productName" TEXT,
            quantity INTEGER,
            price NUMERIC,
            amount NUMERIC
        )
    `);

    const defaultAdminPassword =
    "$2a$10$mHRWZ.POl1TfbCEFYqDH2O6bYMpChS6D0vyy6FAd0y6BX/4ykAFoG";

    await pool.query(
        `INSERT INTO users (username,password,role)
         VALUES ($1,$2,$3)
         ON CONFLICT (username) DO NOTHING`,
        ["admin", defaultAdminPassword, "admin"]
    );

    console.log("Supabase PostgreSQL Database Ready");
}

// ====================
// HOME
// ====================

app.get("/", (req, res)=>{
    res.json({
        message:"HR FOOD PRODUCTS API Running"
    });
});

// ====================
// AUTH API
// ====================

app.post("/api/register", async (req,res)=>{

    try{
        const { username, password, role } = req.body;

        if(!username || !password){
            return res.status(400).json({
                message:"Username and password required"
            });
        }

        const allowedRoles = ["admin","manager","staff"];
        const userRole = allowedRoles.includes(role) ? role : "staff";

        const hashedPassword = await bcrypt.hash(password,10);

        await pool.query(
            `INSERT INTO users (username,password,role)
             VALUES ($1,$2,$3)`,
            [username,hashedPassword,userRole]
        );

        res.json({
            message:"User registered successfully",
            username,
            role:userRole
        });

    }catch(error){
        res.status(400).json({
            message:"User already exists"
        });
    }
});

app.post("/api/login", async (req,res)=>{

    try{
        const { username, password } = req.body;

        if(!username || !password){
            return res.status(400).json({
                message:"Username and password required"
            });
        }

        const result = await pool.query(
            `SELECT * FROM users WHERE username=$1`,
            [username]
        );

        if(result.rows.length === 0){
            return res.status(401).json({
                message:"Invalid username or password"
            });
        }

        const user = result.rows[0];

        const isMatch = await bcrypt.compare(password,user.password);

        if(!isMatch){
            return res.status(401).json({
                message:"Invalid username or password"
            });
        }

        const token = jwt.sign(
            {
                id:user.id,
                username:user.username,
                role:user.role
            },
            JWT_SECRET,
            {
                expiresIn:"1d"
            }
        );

        res.json({
            message:"Login successful",
            token,
            username:user.username,
            role:user.role
        });

    }catch(error){
        res.status(500).json({
            message:"Login failed"
        });
    }
});

app.post(
    "/api/users/create",
    verifyToken,
    allowRoles("admin"),
    async (req,res)=>{

        try{
            const { username, password, role } = req.body;

            const allowedRoles = ["admin","manager","staff"];
            const userRole = allowedRoles.includes(role) ? role : "staff";

            const hashedPassword = await bcrypt.hash(password,10);

            await pool.query(
                `INSERT INTO users (username,password,role)
                 VALUES ($1,$2,$3)`,
                [username,hashedPassword,userRole]
            );

            res.json({
                message:"User created successfully",
                username,
                role:userRole
            });

        }catch(error){
            res.status(400).json({
                message:"User already exists"
            });
        }
    }
);

// ====================
// PRODUCTS API
// ====================

app.get("/api/products", async (req,res)=>{

    try{
        const result = await pool.query(
            `SELECT * FROM products ORDER BY id DESC`
        );

        res.json(result.rows);

    }catch(error){
        res.status(500).json({
            message:"Failed to load products"
        });
    }
});

app.post(
    "/api/products",
    verifyToken,
    allowRoles("admin","manager"),
    async (req,res)=>{

        try{
            const {
                name,
                barcode,
                category,
                buyPrice,
                sellPrice,
                stock,
                minStock
            } = req.body;

            const result = await pool.query(
                `INSERT INTO products
                (name,barcode,category,"buyPrice","sellPrice",stock,"minStock")
                VALUES ($1,$2,$3,$4,$5,$6,$7)
                RETURNING id`,
                [
                    name,
                    barcode || "",
                    category,
                    Number(buyPrice),
                    Number(sellPrice),
                    Number(stock),
                    Number(minStock)
                ]
            );

            res.json({
                message:"Product Added",
                id:result.rows[0].id
            });

        }catch(error){
            res.status(500).json({
                message:"Product add failed"
            });
        }
    }
);

app.put(
    "/api/products/:id",
    verifyToken,
    allowRoles("admin","manager"),
    async (req,res)=>{

        try{
            const {
                name,
                barcode,
                category,
                buyPrice,
                sellPrice,
                stock,
                minStock
            } = req.body;

            const result = await pool.query(
                `UPDATE products
                 SET name=$1,
                     barcode=$2,
                     category=$3,
                     "buyPrice"=$4,
                     "sellPrice"=$5,
                     stock=$6,
                     "minStock"=$7
                 WHERE id=$8`,
                [
                    name,
                    barcode || "",
                    category,
                    Number(buyPrice),
                    Number(sellPrice),
                    Number(stock),
                    Number(minStock),
                    req.params.id
                ]
            );

            if(result.rowCount === 0){
                return res.status(404).json({
                    message:"Product not found"
                });
            }

            res.json({
                message:"Product Updated"
            });

        }catch(error){
            res.status(500).json({
                message:"Product update failed"
            });
        }
    }
);

app.delete(
    "/api/products/:id",
    verifyToken,
    allowRoles("admin"),
    async (req,res)=>{

        try{
            const result = await pool.query(
                `DELETE FROM products WHERE id=$1`,
                [req.params.id]
            );

            if(result.rowCount === 0){
                return res.status(404).json({
                    message:"Product not found"
                });
            }

            res.json({
                message:"Product Deleted"
            });

        }catch(error){
            res.status(500).json({
                message:"Product delete failed"
            });
        }
    }
);

// ====================
// SALES API
// ====================

app.get("/api/sales", async (req,res)=>{

    try{
        const result = await pool.query(
            `SELECT * FROM sales ORDER BY id DESC`
        );

        res.json(result.rows);

    }catch(error){
        res.status(500).json({
            message:"Failed to load sales"
        });
    }
});

app.post(
    "/api/sales",
    verifyToken,
    allowRoles("admin","manager","staff"),
    async (req,res)=>{

        const client = await pool.connect();

        try{
            const { productId, quantity } = req.body;
            const qty = Number(quantity);

            await client.query("BEGIN");

            const productResult = await client.query(
                `SELECT * FROM products WHERE id=$1`,
                [productId]
            );

            if(productResult.rows.length === 0){
                await client.query("ROLLBACK");
                return res.status(404).json({
                    message:"Product Not Found"
                });
            }

            const product = productResult.rows[0];

            if(Number(product.stock) < qty){
                await client.query("ROLLBACK");
                return res.status(400).json({
                    message:"Not Enough Stock"
                });
            }

            const amount = Number(product.sellPrice) * qty;

            await client.query(
                `INSERT INTO sales
                ("productId","productName",quantity,amount)
                VALUES ($1,$2,$3,$4)`,
                [
                    product.id,
                    product.name,
                    qty,
                    amount
                ]
            );

            await client.query(
                `UPDATE products
                 SET stock = stock - $1
                 WHERE id=$2`,
                [qty,product.id]
            );

            await client.query("COMMIT");

            res.json({
                message:"Sale Added",
                amount
            });

        }catch(error){
            await client.query("ROLLBACK");

            res.status(500).json({
                message:"Sale add failed"
            });

        }finally{
            client.release();
        }
    }
);

// ====================
// RESTOCK API
// ====================

app.get("/api/restocks", async (req,res)=>{

    try{
        const result = await pool.query(
            `SELECT * FROM restocks ORDER BY id DESC`
        );

        res.json(result.rows);

    }catch(error){
        res.status(500).json({
            message:"Failed to load restocks"
        });
    }
});

app.post(
    "/api/restocks",
    verifyToken,
    allowRoles("admin","manager"),
    async (req,res)=>{

        const client = await pool.connect();

        try{
            const {
                productId,
                quantity,
                supplier,
                cost
            } = req.body;

            const qty = Number(quantity);

            await client.query("BEGIN");

            const productResult = await client.query(
                `SELECT * FROM products WHERE id=$1`,
                [productId]
            );

            if(productResult.rows.length === 0){
                await client.query("ROLLBACK");
                return res.status(404).json({
                    message:"Product Not Found"
                });
            }

            const product = productResult.rows[0];

            await client.query(
                `INSERT INTO restocks
                ("productId","productName",quantity,supplier,cost)
                VALUES ($1,$2,$3,$4,$5)`,
                [
                    product.id,
                    product.name,
                    qty,
                    supplier,
                    Number(cost)
                ]
            );

            await client.query(
                `UPDATE products
                 SET stock = stock + $1
                 WHERE id=$2`,
                [qty,product.id]
            );

            await client.query("COMMIT");

            res.json({
                message:"Stock Updated"
            });

        }catch(error){
            await client.query("ROLLBACK");

            res.status(500).json({
                message:"Restock add failed"
            });

        }finally{
            client.release();
        }
    }
);

// ====================
// BILLING API
// ====================

app.post(
    "/api/bills",
    verifyToken,
    allowRoles("admin","manager","staff"),
    async (req,res)=>{

        const client = await pool.connect();

        try{
            const { items } = req.body;

            if(!items || !Array.isArray(items) || items.length === 0){
                return res.status(400).json({
                    message:"Bill is empty"
                });
            }

            await client.query("BEGIN");

            const billNo = "BILL-" + Date.now();
            let totalAmount = 0;
            const billItems = [];

            for(const item of items){

                const qty = Number(item.quantity);

                const productResult = await client.query(
                    `SELECT * FROM products WHERE id=$1`,
                    [item.productId]
                );

                if(productResult.rows.length === 0){
                    await client.query("ROLLBACK");
                    return res.status(404).json({
                        message:"Product not found"
                    });
                }

                const product = productResult.rows[0];

                if(Number(product.stock) < qty){
                    await client.query("ROLLBACK");
                    return res.status(400).json({
                        message:`Not enough stock for ${product.name}`
                    });
                }

                const amount = Number(product.sellPrice) * qty;

                totalAmount += amount;

                billItems.push({
                    productId:product.id,
                    productName:product.name,
                    quantity:qty,
                    price:Number(product.sellPrice),
                    amount
                });
            }

            const billResult = await client.query(
                `INSERT INTO bills ("billNo","totalAmount")
                 VALUES ($1,$2)
                 RETURNING id`,
                [billNo,totalAmount]
            );

            const billId = billResult.rows[0].id;

            for(const item of billItems){

                await client.query(
                    `INSERT INTO bill_items
                    ("billId","productId","productName",quantity,price,amount)
                    VALUES ($1,$2,$3,$4,$5,$6)`,
                    [
                        billId,
                        item.productId,
                        item.productName,
                        item.quantity,
                        item.price,
                        item.amount
                    ]
                );

                await client.query(
                    `INSERT INTO sales
                    ("productId","productName",quantity,amount)
                    VALUES ($1,$2,$3,$4)`,
                    [
                        item.productId,
                        item.productName,
                        item.quantity,
                        item.amount
                    ]
                );

                await client.query(
                    `UPDATE products
                     SET stock = stock - $1
                     WHERE id=$2`,
                    [
                        item.quantity,
                        item.productId
                    ]
                );
            }

            await client.query("COMMIT");

            res.json({
                message:"Bill completed successfully",
                billNo,
                totalAmount
            });

        }catch(error){
            await client.query("ROLLBACK");

            res.status(500).json({
                message:"Bill failed"
            });

        }finally{
            client.release();
        }
    }
);

app.get("/api/bills", async (req,res)=>{

    try{
        const billsResult = await pool.query(
            `SELECT * FROM bills ORDER BY id DESC`
        );

        const itemsResult = await pool.query(
            `SELECT * FROM bill_items ORDER BY id ASC`
        );

        const result = billsResult.rows.map(bill => ({
            ...bill,
            items:itemsResult.rows.filter(
                item => Number(item.billId) === Number(bill.id)
            )
        }));

        res.json(result);

    }catch(error){
        res.status(500).json({
            message:"Failed to load bills"
        });
    }
});

// ====================
// DASHBOARD API
// ====================

app.get("/api/dashboard", async (req,res)=>{

    try{
        const products = await pool.query(
            `SELECT COUNT(*) AS "totalProducts" FROM products`
        );

        const stock = await pool.query(
            `SELECT COALESCE(SUM(stock),0) AS "totalStock" FROM products`
        );

        const sales = await pool.query(
            `SELECT COALESCE(SUM(amount),0) AS "totalSales" FROM sales`
        );

        const lowStock = await pool.query(
            `SELECT COUNT(*) AS "lowStock"
             FROM products
             WHERE stock <= "minStock"`
        );

        res.json({
            totalProducts:products.rows[0].totalProducts,
            totalStock:stock.rows[0].totalStock,
            totalSales:sales.rows[0].totalSales,
            lowStock:lowStock.rows[0].lowStock
        });

    }catch(error){
        res.status(500).json({
            message:"Dashboard error"
        });
    }
});

// ====================
// START SERVER
// ====================

initDatabase()
.then(()=>{
    app.listen(PORT, ()=>{
        console.log(`Server Running on Port ${PORT}`);
    });
})
.catch(error=>{
    console.error("Database init failed:", error);
});
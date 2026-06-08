const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "HRFOODPRODUCTS2026";

app.use(cors());
app.use(express.json());

const db = new sqlite3.Database("./database.db");

// ====================
// CREATE TABLES
// ====================

db.serialize(() => {

    db.run(`
        CREATE TABLE IF NOT EXISTS products(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            barcode TEXT,
            category TEXT,
            buyPrice REAL,
            sellPrice REAL,
            stock INTEGER DEFAULT 0,
            minStock INTEGER DEFAULT 10
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS sales(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            productId INTEGER,
            productName TEXT,
            quantity INTEGER,
            amount REAL,
            saleDate DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS restocks(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            productId INTEGER,
            productName TEXT,
            quantity INTEGER,
            supplier TEXT,
            cost REAL,
            restockDate DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS users(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            role TEXT DEFAULT 'staff'
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS bills(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            billNo TEXT,
            totalAmount REAL,
            billDate DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS bill_items(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            billId INTEGER,
            productId INTEGER,
            productName TEXT,
            quantity INTEGER,
            price REAL,
            amount REAL
        )
    `);



    // Add barcode column for old databases
    db.run(`ALTER TABLE products ADD COLUMN barcode TEXT`, (err) => {
        if(err && !err.message.includes("duplicate column name")){
            console.log(err.message);
        }
    });

    // Default admin
    const defaultAdminPassword =
    "$2a$10$mHRWZ.POl1TfbCEFYqDH2O6bYMpChS6D0vyy6FAd0y6BX/4ykAFoG";

    db.run(
        `INSERT OR IGNORE INTO users
        (username, password, role)
        VALUES (?, ?, ?)`,
        ["admin", defaultAdminPassword, "admin"]
    );
});

console.log("Database Ready");

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
// HOME
// ====================

app.get("/", (req, res) => {
    res.json({
        message:"HR FOOD PRODUCTS API Running"
    });
});

// ====================
// AUTH API
// ====================

app.post("/api/register", async (req, res) => {

    const { username, password, role } = req.body;

    if(!username || !password){
        return res.status(400).json({
            message:"Username and password required"
        });
    }

    const allowedRoles = ["admin", "manager", "staff"];
    const userRole = allowedRoles.includes(role) ? role : "staff";

    const hashedPassword = await bcrypt.hash(password, 10);

    db.run(
        "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
        [username, hashedPassword, userRole],
        function(err){

            if(err){
                return res.status(400).json({
                    message:"User already exists"
                });
            }

            res.json({
                message:"User registered successfully",
                username,
                role:userRole
            });
        }
    );
});

app.post("/api/login", (req, res) => {

    const { username, password } = req.body;

    if(!username || !password){
        return res.status(400).json({
            message:"Username and password required"
        });
    }

    db.get(
        "SELECT * FROM users WHERE username=?",
        [username],
        async (err, user)=>{

            if(err){
                return res.status(500).json({
                    message:"Database error"
                });
            }

            if(!user){
                return res.status(401).json({
                    message:"Invalid username or password"
                });
            }

            const isMatch = await bcrypt.compare(password, user.password);

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
        }
    );
});

// Admin create user

app.post(
    "/api/users/create",
    verifyToken,
    allowRoles("admin"),
    async (req, res) => {

        const { username, password, role } = req.body;

        if(!username || !password){
            return res.status(400).json({
                message:"Username and password required"
            });
        }

        const allowedRoles = ["admin", "manager", "staff"];
        const userRole = allowedRoles.includes(role) ? role : "staff";

        const hashedPassword = await bcrypt.hash(password, 10);

        db.run(
            "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
            [username, hashedPassword, userRole],
            function(err){

                if(err){
                    return res.status(400).json({
                        message:"User already exists"
                    });
                }

                res.json({
                    message:"User created successfully",
                    username,
                    role:userRole
                });
            }
        );
    }
);

// ====================
// PRODUCTS API
// ====================

app.get("/api/products", (req, res) => {

    db.all(
        "SELECT * FROM products ORDER BY id DESC",
        [],
        (err, rows) => {

            if(err){
                return res.status(500).json({
                    message:"Failed to load products"
                });
            }

            res.json(rows);
        }
    );
});

// Add product

app.post(
    "/api/products",
    verifyToken,
    allowRoles("admin", "manager"),
    (req, res) => {

        const {
            name,
            barcode,
            category,
            buyPrice,
            sellPrice,
            stock,
            minStock
        } = req.body;

        if(!name || !category){
            return res.status(400).json({
                message:"Product name and category required"
            });
        }

        db.run(
            `INSERT INTO products
            (name, barcode, category, buyPrice, sellPrice, stock, minStock)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                name,
                barcode || "",
                category,
                Number(buyPrice),
                Number(sellPrice),
                Number(stock),
                Number(minStock)
            ],
            function(err){

                if(err){
                    return res.status(500).json({
                        message:"Product add failed"
                    });
                }

                res.json({
                    message:"Product Added",
                    id:this.lastID
                });
            }
        );
    }
);

// Update product

app.put(
    "/api/products/:id",
    verifyToken,
    allowRoles("admin", "manager"),
    (req, res) => {

        const {
            name,
            barcode,
            category,
            buyPrice,
            sellPrice,
            stock,
            minStock
        } = req.body;

        db.run(
            `UPDATE products
             SET name=?, barcode=?, category=?, buyPrice=?, sellPrice=?, stock=?, minStock=?
             WHERE id=?`,
            [
                name,
                barcode || "",
                category,
                Number(buyPrice),
                Number(sellPrice),
                Number(stock),
                Number(minStock),
                req.params.id
            ],
            function(err){

                if(err){
                    return res.status(500).json({
                        message:"Product update failed"
                    });
                }

                if(this.changes === 0){
                    return res.status(404).json({
                        message:"Product not found"
                    });
                }

                res.json({
                    message:"Product Updated"
                });
            }
        );
    }
);

// Delete product

app.delete(
    "/api/products/:id",
    verifyToken,
    allowRoles("admin"),
    (req, res)=>{

        db.run(
            "DELETE FROM products WHERE id=?",
            [req.params.id],
            function(err){

                if(err){
                    return res.status(500).json({
                        message:"Product delete failed"
                    });
                }

                if(this.changes === 0){
                    return res.status(404).json({
                        message:"Product not found"
                    });
                }

                res.json({
                    message:"Product Deleted"
                });
            }
        );
    }
);

// ====================
// SALES API
// ====================

app.get("/api/sales", (req,res)=>{

    db.all(
        "SELECT * FROM sales ORDER BY id DESC",
        [],
        (err,rows)=>{

            if(err){
                return res.status(500).json({
                    message:"Failed to load sales"
                });
            }

            res.json(rows);
        }
    );
});

app.post(
    "/api/sales",
    verifyToken,
    allowRoles("admin", "manager", "staff"),
    (req,res)=>{

        const { productId, quantity } = req.body;
        const qty = Number(quantity);

        if(!productId || qty <= 0){
            return res.status(400).json({
                message:"Valid product and quantity required"
            });
        }

        db.get(
            "SELECT * FROM products WHERE id=?",
            [productId],
            (err, product)=>{

                if(err){
                    return res.status(500).json({
                        message:"Database error"
                    });
                }

                if(!product){
                    return res.status(404).json({
                        message:"Product Not Found"
                    });
                }

                if(Number(product.stock) < qty){
                    return res.status(400).json({
                        message:"Not Enough Stock"
                    });
                }

                const amount = Number(product.sellPrice) * qty;

                db.run(
                    `INSERT INTO sales
                    (productId, productName, quantity, amount)
                    VALUES (?, ?, ?, ?)`,
                    [
                        product.id,
                        product.name,
                        qty,
                        amount
                    ],
                    function(err){

                        if(err){
                            return res.status(500).json({
                                message:"Sale add failed"
                            });
                        }

                        db.run(
                            `UPDATE products
                             SET stock = stock - ?
                             WHERE id=?`,
                            [
                                qty,
                                product.id
                            ],
                            function(updateErr){

                                if(updateErr){
                                    return res.status(500).json({
                                        message:"Stock update failed"
                                    });
                                }

                                res.json({
                                    message:"Sale Added",
                                    amount
                                });
                            }
                        );
                    }
                );
            }
        );
    }
);

// ====================
// RESTOCK API
// ====================

app.get("/api/restocks", (req,res)=>{

    db.all(
        "SELECT * FROM restocks ORDER BY id DESC",
        [],
        (err,rows)=>{

            if(err){
                return res.status(500).json({
                    message:"Failed to load restocks"
                });
            }

            res.json(rows);
        }
    );
});

app.post(
    "/api/restocks",
    verifyToken,
    allowRoles("admin", "manager"),
    (req,res)=>{

        const {
            productId,
            quantity,
            supplier,
            cost
        } = req.body;

        const qty = Number(quantity);

        if(!productId || qty <= 0){
            return res.status(400).json({
                message:"Valid product and quantity required"
            });
        }

        db.get(
            "SELECT * FROM products WHERE id=?",
            [productId],
            (err, product)=>{

                if(err){
                    return res.status(500).json({
                        message:"Database error"
                    });
                }

                if(!product){
                    return res.status(404).json({
                        message:"Product Not Found"
                    });
                }

                db.run(
                    `INSERT INTO restocks
                    (productId, productName, quantity, supplier, cost)
                    VALUES (?, ?, ?, ?, ?)`,
                    [
                        product.id,
                        product.name,
                        qty,
                        supplier,
                        Number(cost)
                    ],
                    function(err){

                        if(err){
                            return res.status(500).json({
                                message:"Restock add failed"
                            });
                        }

                        db.run(
                            `UPDATE products
                             SET stock = stock + ?
                             WHERE id=?`,
                            [
                                qty,
                                product.id
                            ],
                            function(updateErr){

                                if(updateErr){
                                    return res.status(500).json({
                                        message:"Stock update failed"
                                    });
                                }

                                res.json({
                                    message:"Stock Updated"
                                });
                            }
                        );
                    }
                );
            }
        );
    }
);

// ====================
// BILLING API
// ====================

app.post(
    "/api/bills",
    verifyToken,
    allowRoles("admin", "manager", "staff"),
    (req, res) => {

        const { items } = req.body;

        if(!items || !Array.isArray(items) || items.length === 0){
            return res.status(400).json({
                message:"Bill is empty"
            });
        }

        const billNo = "BILL-" + Date.now();
        let totalAmount = 0;
        let billItems = [];
        let completed = 0;
        let failed = false;

        db.run("BEGIN TRANSACTION");

        items.forEach(item => {

            const qty = Number(item.quantity);

            db.get(
                "SELECT * FROM products WHERE id=?",
                [item.productId],
                (err, product) => {

                    if(failed) return;

                    if(err || !product){
                        failed = true;
                        db.run("ROLLBACK");
                        return res.status(404).json({
                            message:"Product not found"
                        });
                    }

                    if(qty <= 0){
                        failed = true;
                        db.run("ROLLBACK");
                        return res.status(400).json({
                            message:"Invalid quantity"
                        });
                    }

                    if(Number(product.stock) < qty){
                        failed = true;
                        db.run("ROLLBACK");
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

                    completed++;

                    if(completed === items.length){
                        saveBill();
                    }
                }
            );
        });

        function saveBill(){

            db.run(
                "INSERT INTO bills (billNo,totalAmount) VALUES (?,?)",
                [billNo,totalAmount],
                function(err){

                    if(err){
                        db.run("ROLLBACK");
                        return res.status(500).json({
                            message:"Bill save failed"
                        });
                    }

                    const billId = this.lastID;
                    let savedItems = 0;

                    billItems.forEach(billItem => {

                        db.run(
                            `INSERT INTO bill_items
                            (billId,productId,productName,quantity,price,amount)
                            VALUES (?,?,?,?,?,?)`,
                            [
                                billId,
                                billItem.productId,
                                billItem.productName,
                                billItem.quantity,
                                billItem.price,
                                billItem.amount
                            ],
                            function(itemErr){

                                if(itemErr && !failed){
                                    failed = true;
                                    db.run("ROLLBACK");
                                    return res.status(500).json({
                                        message:"Bill item save failed"
                                    });
                                }

                                db.run(
                                    `INSERT INTO sales
                                    (productId,productName,quantity,amount)
                                    VALUES (?,?,?,?)`,
                                    [
                                        billItem.productId,
                                        billItem.productName,
                                        billItem.quantity,
                                        billItem.amount
                                    ],
                                    function(saleErr){

                                        if(saleErr && !failed){
                                            failed = true;
                                            db.run("ROLLBACK");
                                            return res.status(500).json({
                                                message:"Sale save failed"
                                            });
                                        }

                                        db.run(
                                            "UPDATE products SET stock = stock - ? WHERE id=?",
                                            [
                                                billItem.quantity,
                                                billItem.productId
                                            ],
                                            function(stockErr){

                                                if(stockErr && !failed){
                                                    failed = true;
                                                    db.run("ROLLBACK");
                                                    return res.status(500).json({
                                                        message:"Stock update failed"
                                                    });
                                                }

                                                savedItems++;

                                                if(savedItems === billItems.length && !failed){
                                                    db.run("COMMIT");

                                                    res.json({
                                                        message:"Bill completed successfully",
                                                        billNo,
                                                        totalAmount
                                                    });
                                                }
                                            }
                                        );
                                    }
                                );
                            }
                        );
                    });
                }
            );
        }
    }
);

app.get("/api/bills", (req, res) => {

    db.all(
        "SELECT * FROM bills ORDER BY id DESC",
        [],
        (err, bills) => {

            if(err){
                return res.status(500).json({
                    message:"Failed to load bills"
                });
            }

            db.all(
                "SELECT * FROM bill_items ORDER BY id ASC",
                [],
                (err2, items) => {

                    if(err2){
                        return res.status(500).json({
                            message:"Failed to load bill items"
                        });
                    }

                    const result = bills.map(bill => ({
                        ...bill,
                        items:items.filter(item => item.billId === bill.id)
                    }));

                    res.json(result);
                }
            );
        }
    );
});

// ====================
// DASHBOARD API
// ====================

app.get("/api/dashboard", (req,res)=>{

    db.get(
        `SELECT COUNT(*) as totalProducts FROM products`,
        [],
        (err, productData)=>{

            if(err){
                return res.status(500).json({
                    message:"Dashboard error"
                });
            }

            db.get(
                `SELECT IFNULL(SUM(stock),0) as totalStock FROM products`,
                [],
                (err, stockData)=>{

                    if(err){
                        return res.status(500).json({
                            message:"Dashboard error"
                        });
                    }

                    db.get(
                        `SELECT IFNULL(SUM(amount),0) as totalSales FROM sales`,
                        [],
                        (err, salesData)=>{

                            if(err){
                                return res.status(500).json({
                                    message:"Dashboard error"
                                });
                            }

                            db.get(
                                `SELECT COUNT(*) as lowStock
                                 FROM products
                                 WHERE stock <= minStock`,
                                [],
                                (err, lowData)=>{

                                    if(err){
                                        return res.status(500).json({
                                            message:"Dashboard error"
                                        });
                                    }

                                    res.json({
                                        totalProducts: productData.totalProducts,
                                        totalStock: stockData.totalStock,
                                        totalSales: salesData.totalSales,
                                        lowStock: lowData.lowStock
                                    });
                                }
                            );
                        }
                    );
                }
            );
        }
    );
});

// ====================
// START SERVER
// ====================

app.listen(PORT, ()=>{
    console.log(`Server Running on Port ${PORT}`);
});
async function loadProducts() {

    const res = await fetch(`${API_URL}/products`);
    const products = await res.json();

    const tbody = document.querySelector("#productTable tbody");

    if (!tbody) {
        console.error("Table body not found!");
        return;
    }

    tbody.innerHTML = "";

    products.forEach(product => {

        tbody.innerHTML += `
        <tr>
            <td>${product.id}</td>
            <td>${product.name}</td>
            <td>${product.category}</td>
            <td>${product.stock}</td>
            <td>₹${product.sellPrice}</td>
            <td>
                <button onclick="deleteProduct(${product.id})">
                    Delete
                </button>
            </td>
        </tr>
        `;

    });

}

async function deleteProduct(id){

    await fetch(`${API_URL}/products/${id}`,{
        method:"DELETE"
    });

    loadProducts();
}

document.addEventListener("DOMContentLoaded", () => {

    loadProducts();

    const form = document.getElementById("productForm");

    form.addEventListener("submit", async (e) => {

        e.preventDefault();

        const name = document.getElementById("name").value;
        const category = document.getElementById("category").value;
        const buyPrice = document.getElementById("buyPrice").value;
        const sellPrice = document.getElementById("sellPrice").value;
        const stock = document.getElementById("stock").value;
        const minStock = document.getElementById("minStock").value;

        if (!name || !category || !buyPrice || !sellPrice || !stock) {
            alert("Please fill all required fields");
            return;
        }

        await fetch(`${API_URL}/products`,{

            method:"POST",

            headers:{
                "Content-Type":"application/json"
            },

            body:JSON.stringify({
                name,
                category,
                buyPrice,
                sellPrice,
                stock,
                minStock
            })

        });

        alert("Product Added");

        form.reset();

        loadProducts();

    });

});
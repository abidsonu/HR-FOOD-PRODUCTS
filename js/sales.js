let products = [];

async function loadProducts(){

const res =
await fetch(`${API_URL}/products`);

products =
await res.json();

const select =
document.getElementById("productSelect");

select.innerHTML =
'<option value="">Select Product</option>';

products.forEach(product=>{

select.innerHTML += `

<option value="${product.id}">

${product.name}

</option>

`;

});

}

document
.getElementById("productSelect")
.addEventListener("change",()=>{

const id =
document.getElementById("productSelect").value;

const product =
products.find(
p=>p.id == id
);

if(product){

document.getElementById("price")
.innerText =
product.sellPrice;

document.getElementById("stock")
.innerText =
product.stock;

calculateAmount();

}

});

document
.getElementById("quantity")
.addEventListener("input",
calculateAmount);

function calculateAmount(){

const id =
document.getElementById("productSelect").value;

const qty =
Number(
document.getElementById("quantity")
.value
);

const product =
products.find(
p=>p.id == id
);

if(product){

document.getElementById("amount")
.innerText =
qty *
product.sellPrice;

}

}

document
.getElementById("salesForm")
.addEventListener("submit",
async(e)=>{

e.preventDefault();

const productId =
document.getElementById("productSelect")
.value;

const quantity =
document.getElementById("quantity")
.value;

const res =
await fetch(
`${API_URL}/sales`,
{
method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({

productId,
quantity

})

}
);

const data =
await res.json();

alert(data.message);

document
.getElementById("salesForm")
.reset();

loadProducts();
loadSales();

});

async function loadSales(){

const res =
await fetch(
`${API_URL}/sales`
);

const sales =
await res.json();

const table =
document.getElementById(
"salesTable"
);

table.innerHTML = "";

let totalSales = 0;

sales.forEach(sale=>{

totalSales +=
sale.amount;

table.innerHTML += `

<tr>

<td>${sale.id}</td>

<td>${sale.productName}</td>

<td>${sale.quantity}</td>

<td>₹${sale.amount}</td>

<td>
${new Date(
sale.saleDate
).toLocaleDateString()}
</td>

</tr>

`;

});

document
.getElementById("totalSales")
.innerText =
`₹${totalSales}`;

document
.getElementById("totalOrders")
.innerText =
sales.length;

}

loadProducts();
loadSales();
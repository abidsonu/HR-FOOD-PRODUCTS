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

document.getElementById("currentStock")
.innerText =
product.stock;

}

});

document
.getElementById("restockForm")
.addEventListener("submit",
async(e)=>{

e.preventDefault();

const productId =
document.getElementById("productSelect")
.value;

const quantity =
document.getElementById("quantity")
.value;

const supplier =
document.getElementById("supplier")
.value;

const cost =
document.getElementById("cost")
.value;

const res =
await fetch(
`${API_URL}/restocks`,
{
method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({

productId,
quantity,
supplier,
cost

})

}
);

const data =
await res.json();

alert(data.message);

document
.getElementById("restockForm")
.reset();

loadProducts();
loadRestocks();

});

async function loadRestocks(){

const res =
await fetch(
`${API_URL}/restocks`
);

const restocks =
await res.json();

const table =
document.getElementById(
"restockTable"
);

table.innerHTML = "";

let totalCost = 0;

restocks.forEach(item=>{

totalCost +=
Number(item.cost);

table.innerHTML += `

<tr>

<td>${item.id}</td>

<td>${item.productName}</td>

<td>${item.quantity}</td>

<td>${item.supplier}</td>

<td>₹${item.cost}</td>

<td>
${new Date(
item.restockDate
).toLocaleDateString()}
</td>

</tr>

`;

});

document
.getElementById("totalRestocks")
.innerText =
restocks.length;

document
.getElementById("totalCost")
.innerText =
`₹${totalCost}`;

}

loadProducts();
loadRestocks();
async function loadReports(){

// Dashboard Data

const dashboardRes =
await fetch(`${API_URL}/dashboard`);

const dashboard =
await dashboardRes.json();

document.getElementById(
"totalProducts"
).innerText =
dashboard.totalProducts;

document.getElementById(
"totalStock"
).innerText =
dashboard.totalStock;

document.getElementById(
"totalSales"
).innerText =
"₹" + dashboard.totalSales;


// Sales Report

const salesRes =
await fetch(`${API_URL}/sales`);

const sales =
await salesRes.json();

document.getElementById(
"totalOrders"
).innerText =
sales.length;

const salesTable =
document.getElementById(
"salesReport"
);

salesTable.innerHTML = "";

sales.slice(0,20)
.forEach(sale=>{

salesTable.innerHTML += `

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


// Restock Report

const restockRes =
await fetch(`${API_URL}/restocks`);

const restocks =
await restockRes.json();

const restockTable =
document.getElementById(
"restockReport"
);

restockTable.innerHTML = "";

restocks.slice(0,20)
.forEach(item=>{

restockTable.innerHTML += `

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

}

loadReports();
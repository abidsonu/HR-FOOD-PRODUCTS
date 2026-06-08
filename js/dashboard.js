async function loadDashboard(){

    const res =
    await fetch(`${API_URL}/dashboard`);

    const data =
    await res.json();

    document
    .getElementById("totalProducts")
    .innerText =
    data.totalProducts;

    document
    .getElementById("totalStock")
    .innerText =
    data.totalStock;

    document
    .getElementById("totalSales")
    .innerText =
    "₹" + data.totalSales;

    document
    .getElementById("lowStock")
    .innerText =
    data.lowStock;

}

loadDashboard();
if(!localStorage.getItem("token")){
    window.location.href = "login.html";
}

function logout(){
    localStorage.removeItem("token");
    localStorage.removeItem("adminUser");
    window.location.href = "login.html";
}

function showAdminName(){
    const admin = localStorage.getItem("adminUser") || "Admin";

    const adminName = document.getElementById("adminName");

    if(adminName){
        adminName.innerText = admin;
    }
}

showAdminName();
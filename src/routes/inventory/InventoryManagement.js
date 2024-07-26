import React from "react";
import Header from "../Header";
import "./Inventory.css";
import InventoryPage from "./InventoryPage";

function InventoryManagement() {
  return (
    <div>
      <Header page={"Inventory Management"} />
      <div className="mt-16 ml-72 mr-28 ">
        {" "}
        <InventoryPage />
      </div>

      {/* <ul class="flex-container">
        <li class="flex-item flex-item-1">1</li>
        <li class="flex-item flex-item-2">2</li>
        <li class="flex-item flex-item-3">3</li>
        <li class="flex-item flex-item-4">4</li>
        <li class="flex-item flex-item-5">5</li>
        <li class="flex-item flex-item-6">6</li>

        <li class="flex-item flex-item-7">7</li>
        <li class="flex-item flex-item-8">8</li>
        <li class="flex-item flex-item-9">9</li>
        <li class="flex-item flex-item-10">10</li>
        <li class="flex-item flex-item-11">11</li>
        <li class="flex-item flex-item-12">12</li>
      </ul>

      <div class="wrapper">
        <header class="header">Header</header>
        <article class="main">
          <p>Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Vestibulum tortor quam, feugiat vitae, ultricies eget, tempor sit amet, ante. Donec eu libero sit amet quam egestas semper. Aenean ultricies mi vitae est. Mauris placerat eleifend leo.</p>
        </article>
        <aside class="aside aside-1">Aside 1</aside>
        <aside class="aside aside-2">Aside 2</aside>
        <footer class="footer">Footer</footer>
      </div> */}
    </div>
  );
}

export default InventoryManagement;

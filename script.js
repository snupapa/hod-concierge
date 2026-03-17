const products = [
  {
    id: "midnight-floral",
    name: "Midnight Floral Jamdani",
    price: 16800,
    image: "/products/IMG20250321173059-removebg-preview.png",
  },
  {
    id: "crimson-vine",
    name: "Crimson Vine Jamdani",
    price: 15400,
    image: "/products/IMG20250321175951-removebg-preview.png",
  },
  {
    id: "emerald-garden",
    name: "Emerald Garden Jamdani",
    price: 17600,
    image: "/products/IMG20250321180436-removebg-preview.png",
  },
  {
    id: "ivory-blossom",
    name: "Ivory Blossom Jamdani",
    price: 16200,
    image: "/products/IMG20250321180511-removebg-preview.png",
  },
];

const productGrid = document.querySelector("#product-grid");

if (productGrid) {
  renderProducts(products, productGrid);
}

function renderProducts(items, container) {
  const markup = items
    .map((product) => {
      const price = new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }).format(product.price);

      return `
        <article class="product-card">
          <div class="product-image-wrap">
            <img
              class="product-image"
              src="${product.image}"
              alt="${product.name}"
              loading="lazy"
              decoding="async"
              sizes="(max-width: 699px) 100vw, (max-width: 1039px) 50vw, 25vw"
            />
          </div>
          <div class="product-body">
            <h3 class="product-title">${product.name}</h3>
            <p class="product-price">${price}</p>
          </div>
        </article>
      `;
    })
    .join("");

  container.innerHTML = markup;
}

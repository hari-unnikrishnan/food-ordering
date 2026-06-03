import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AddMenuItemPage.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000/api";

export default function AddMenuItemPage() {
  const navigate = useNavigate();

  const [category, setCategory] = useState("");
  const [name, setName] = useState("");
  const [priceRaw, setPriceRaw] = useState("");
  const [description, setDescription] = useState("");
  // 3-state availability: available | unavailable | special

  const [availability, setAvailability] = useState("available");

  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);

  // reset to available by default if needed could go here

  useEffect(() => {

    if (!imageFile) {
      setImagePreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(imageFile);
    setImagePreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [imageFile]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    // Load categories for the dropdown.
    // Submit flow still supports creating a missing category.
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/categories/`);
        if (!res.ok) return;
        const data = await res.json();
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.results)
            ? data.results
            : Array.isArray(data?.data)
              ? data.data
              : [];
        setCategories(list);
      } catch (e) {
        // No-op: keep dropdown usable with placeholder.
      }
    })();
  }, []);

  function validate() {
    const c = category.trim();

    const n = name.trim();
    const d = description.trim();

    const price = Number(priceRaw);
    if (!c) return "Enter category";
    if (!n) return "Enter item name";
    if (!priceRaw.trim()) return "Enter price";
    if (Number.isNaN(price) || price <= 0) return "Invalid price";

    return { category: c, name: n, description: d, price };
  }

  return (
    <div className="add-menu-page">
      <div className="add-menu-card">
        <h1 className="add-menu-title">Add Menu Item</h1>

        <div className="add-menu-form">
          <label className="add-menu-label">
            <span>Category</span>

            <div className="category-input-group">
              {/* SELECT CATEGORY */}
              <select
                className="add-menu-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Select category</option>

                {categories.map((cat) => (
                  <option key={cat?.id ?? cat?.name} value={cat?.name}>
                    {cat?.name}
                  </option>
                ))}
              </select>

              {/* MANUAL INPUT */}
              <input
                type="text"
                className="add-menu-input"
                placeholder=" Enter New Category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>
          </label>



          <label className="add-menu-label">
            <span>Item name</span>
            <input className="add-menu-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Idli" />
          </label>

          <label className="add-menu-label">
            <span>Price</span>
            <input
              className="add-menu-input"
              value={priceRaw}
              onChange={(e) => setPriceRaw(e.target.value)}
              placeholder="e.g. 12.50"
            />
          </label>

          <label className="add-menu-label">
            <span>Description (optional)</span>
            <textarea
              className="add-menu-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </label>

          <label className="add-menu-label">
            <span>Availability</span>
            <select
              className="add-menu-select"
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
            >
              <option value="available">Available</option>
              <option value="unavailable">Unavailable</option>
              <option value="special">special</option>
            </select>
          </label>



          <label className="add-menu-label">
            <span>Upload image</span>
            <input
              className="add-menu-file"
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
            />
          </label>

          {imagePreviewUrl ? (
            <div className="add-menu-image-preview" aria-live="polite">
              <img src={imagePreviewUrl} alt="Selected" />
            </div>
          ) : null}

          <div className="add-menu-actions">
            <button type="button" className="add-menu-btn cancel" disabled={isSubmitting} onClick={() => navigate("/")}
            >
              Cancel
            </button>

            <button
              type="button"
              className="add-menu-btn submit"
              disabled={isSubmitting}
              onClick={async () => {
                const validated = validate();
                if (typeof validated === "string") {
                  alert(validated);
                  return;
                }

                const { category: c, name: n, description: d, price } = validated;


                try {
                  setIsSubmitting(true);

                  // =========================
                  // 1) CREATE CATEGORY IF NOT EXISTS
                  // =========================
                  const categoriesRes = await fetch(`${API_BASE}/categories/`);
                  if (!categoriesRes.ok) {
                    const text = await categoriesRes.text();
                    throw new Error(text || "Failed to load categories");
                  }

                  const categoriesData = await categoriesRes.json();
                  const categoryList = Array.isArray(categoriesData)
                    ? categoriesData
                    : Array.isArray(categoriesData?.results)
                      ? categoriesData.results
                      : Array.isArray(categoriesData?.data)
                        ? categoriesData.data
                        : [];

                  const existingCategory = categoryList.find(
                    (cat) => String(cat?.name || "").toLowerCase() === String(c).toLowerCase()
                  );

                  let categoryNameToSend = String(c).trim();
                  if (!existingCategory) {
                    const createCategoryRes = await fetch(`${API_BASE}/categories/`, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({ name: categoryNameToSend }),
                    });

                    if (!createCategoryRes.ok) {
                      const text = await createCategoryRes.text();
                      throw new Error(text || "Failed to create category");
                    }
                  }

                  // Item serializer accepts category by name (SlugRelatedField).
                  // So we always send the category name (ensured to exist).

                  // =========================
                  // 2) CREATE ITEM
                  // =========================
                  const form = new FormData();
                  form.set("category", categoryNameToSend);
                  form.set("name", n);
                  form.set("price", String(price));
                  form.set("description", d);
                  // Backend expects 3-state string: available | unavailable | special
                  form.set("availability", availability);

                  if (imageFile) form.set("image", imageFile);


                  const res = await fetch(`${API_BASE}/items/`, {
                    method: "POST",
                    body: form,
                  });

                  if (!res.ok) {
                    const text = await res.text();
                    throw new Error(text || "Failed to add item");
                  }

                  // =========================
                  // 3) GO BACK TO POS
                  // =========================
                  navigate("/", { state: { addedItem: true, addedCategory: c } });
                } catch (e) {
                  console.error(e);
                  alert(e?.message || "Failed to add item");
                } finally {
                  setIsSubmitting(false);
                }
              }}
            >
              {isSubmitting ? "Adding..." : "Add Item"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


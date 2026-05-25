require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const ZOHO = {
  clientId: process.env.ZOHO_CLIENT_ID,
  clientSecret: process.env.ZOHO_CLIENT_SECRET,
  tokenUrl: "https://accounts.zoho.com/oauth/v2/token",
  apiBase: "https://www.zohoapis.com/crm/v2",
  module: "Transactions",
};

// In-memory token store (survives restarts via env var ZOHO_REFRESH_TOKEN)
let tokenStore = {
  access_token: process.env.ZOHO_ACCESS_TOKEN || "",
  refresh_token: process.env.ZOHO_REFRESH_TOKEN || "",
  expires_at: 0,
};

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

async function refreshAccessToken() {
  if (!tokenStore.refresh_token) {
    throw new Error("No refresh token. Call POST /auth/set-tokens first.");
  }

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: ZOHO.clientId,
    client_secret: ZOHO.clientSecret,
    refresh_token: tokenStore.refresh_token,
  });

  const { data } = await axios.post(ZOHO.tokenUrl, params.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  if (data.error) throw new Error(`Token refresh failed: ${data.error}`);

  tokenStore.access_token = data.access_token;
  tokenStore.expires_at = Date.now() + data.expires_in * 1000;
  return tokenStore.access_token;
}

async function getAccessToken() {
  if (tokenStore.access_token && Date.now() < tokenStore.expires_at - 60000) {
    return tokenStore.access_token;
  }
  return refreshAccessToken();
}

// ---------------------------------------------------------------------------
// Route: set tokens manually (run once after deployment)
// ---------------------------------------------------------------------------

app.post("/auth/set-tokens", (req, res) => {
  const { access_token, refresh_token } = req.body;
  if (!refresh_token) return res.status(400).json({ error: "refresh_token is required" });

  tokenStore.access_token = access_token || "";
  tokenStore.refresh_token = refresh_token;
  tokenStore.expires_at = access_token ? Date.now() + 3600 * 1000 : 0;

  res.json({ message: "Tokens saved in memory. Server will auto-refresh using refresh_token." });
});

// ---------------------------------------------------------------------------
// Route: POST /transactions — create a record in Zoho CRM
// ---------------------------------------------------------------------------

app.post("/transactions", async (req, res) => {
  try {
    const body = req.body;

    const record = {
      Name:                         body.name,
      Brand:                        body.brand,
      Category:                     body.category,
      Certificate_Number:           body.certificate_number,
      Cost:                         body.cost,
      Cost_Code:                    body.cost_code,
      Country:                      body.nationality,
      Customer_Contact_No:          body.customer_contact_no,
      Customer_Contact_Number:      body.customer_contact_number,
      Customer_interest:            body.customer_interest,
      Description:                  body.description,
      Design_Number:                body.design_number,
      Design:                       body.design_type,
      DIA_Carat_Weight:             body.dia_carat_weight,
      Diamond_Amount_Per_CT:        body.diamond_amount_per_ct,
      Diamond_Clarity:              body.diamond_clarity,
      Diamond_Division:             body.diamond_division,
      Diamond_Selling_Rate:         body.diamond_selling_rate,
      Diamond_Selling_Value:        body.diamond_selling_value,
      Diamond_Size:                 body.diamond_size,
      Diamond_Value:                body.diamond_value,
      Email:                        body.email,
      Gross_Weight:                 body.gross_weight,
      Item_Division:                body.item_division,
      Labour_Charges:               body.labour_charges,
      Location:                     body.location,
      Main_Stock_Code:              body.main_stock_code,
      Making:                       body.making,
      Making_Price_1:               body.making_price_1,
      Making_Price_2:               body.making_price_2,
      Making_Price_3:               body.making_price_3,
      Metal_Carat:                  body.metal_carat,
      Metal_Colour:                 body.metal_colour,
      Metal_Division:               body.metal_division,
      Metal_Gross_Weight:           body.metal_gross_weight,
      Metal_Rate_pure:              body.metal_rate_pure,
      Metal_Rate_Type:              body.metal_rate_type,
      Metal_Value:                  body.metal_value,
      Metal_WT:                     body.metal_wt,
      Misc_Charges:                 body.misc_charges,
      Net_Weight:                   body.net_weight,
      No_of_Diamonds:               body.no_of_diamonds,
      PCS:                          body.pcs,
      Polishing_Charges:            body.polishing_charges,
      Prefix_Code:                  body.prefix_code,
      Price_Code:                   body.price_code,
      Purity:                       body.purity,
      Quantity:                     body.quantity,
      Religion:                     body.religion,
      Rhodium_Charges:              body.rhodium_charges,
      Secondary_Email:              body.secondary_email,
      SET:                          body.set,
      Setting_Charges:              body.setting_charges,
      Size:                         body.size,
      Stock_Code:                   body.stock_code,
      Stone_Code:                   body.stone_code,
      Stone_Rate:                   body.stone_rate,
      Stone_Selling_Rate_Per_Carat: body.stone_selling_rate_per_carat,
      Stone_Selling_Value:          body.stone_selling_value,
      Stone_Type:                   body.stone_type,
      Stone_Value:                  body.stone_value,
      Stone_Weight:                 body.stone_weight,
      Style:                        body.style_type,
      Sub_Category:                 body.sub_category,
      Supplier_Name:                body.supplier_name,
      Supplier_Purchase_Number:     body.supplier_purchase_number,
      Supplier_Ref:                 body.supplier_ref,
      Tag:                          body.tag,
      Tag_line_1:                   body.tag_line_1,
      Tag_line_2:                   body.tag_line_2,
      Tag_line_3:                   body.tag_line_3,
      Tag_line_4:                   body.tag_line_4,
      Tag_line_5:                   body.tag_line_5,
      Tag_Price_1:                  body.tag_price_1,
      Tag_Price_2:                  body.tag_price_2,
      Tag_Price_3:                  body.tag_price_3,
      Type:                         body.type,
      Wastage:                      body.wastage,
    };

    Object.keys(record).forEach((k) => record[k] === undefined && delete record[k]);

    if (!record.Name) {
      return res.status(400).json({ error: "Field 'name' is required." });
    }

    const accessToken = await getAccessToken();

    const { data } = await axios.post(
      `${ZOHO.apiBase}/${ZOHO.module}`,
      { data: [record] },
      { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } }
    );

    res.status(201).json({ message: "Record created", zoho_response: data });
  } catch (err) {
    res.status(500).json({ error: err.message, details: err.response?.data });
  }
});

// ---------------------------------------------------------------------------
// Route: GET /transactions/:id — fetch a single record
// ---------------------------------------------------------------------------

app.get("/transactions/:id", async (req, res) => {
  try {
    const accessToken = await getAccessToken();
    const { data } = await axios.get(`${ZOHO.apiBase}/${ZOHO.module}/${req.params.id}`, {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message, details: err.response?.data });
  }
});

// ---------------------------------------------------------------------------

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

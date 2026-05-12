package catalog

import (
	"fmt"

	"github.com/rs/zerolog/log"
	"github.com/xuri/excelize/v2"

	"github.com/rshb/svoe-rodnoe-calendar/api/internal/db"
	"github.com/rshb/svoe-rodnoe-calendar/api/internal/models"
)

// Importer pulls farmers_sku.xlsx into SurrealDB. The xlsx schema is:
//   organization_id | shop_name | farmer_description | region | category |
//   name_product | product_id | product_description | url_product | url_farmer
type Importer struct {
	Repo *db.Repo
}

func NewImporter(r *db.Repo) *Importer { return &Importer{Repo: r} }

// ImportXLSX loads the workbook and writes farmers + products. Idempotent — uses
// UpsertFarmer / UpsertProduct, so re-running keeps DB consistent.
func (i *Importer) ImportXLSX(path string) (farmers, products int, err error) {
	f, err := excelize.OpenFile(path)
	if err != nil {
		return 0, 0, fmt.Errorf("open xlsx: %w", err)
	}
	defer f.Close()

	sheet := f.GetSheetName(0)
	rows, err := f.GetRows(sheet)
	if err != nil {
		return 0, 0, err
	}
	if len(rows) < 2 {
		return 0, 0, fmt.Errorf("xlsx looks empty")
	}

	header := rows[0]
	idx := indexHeader(header)
	if idx["product_id"] < 0 || idx["organization_id"] < 0 {
		return 0, 0, fmt.Errorf("missing required columns in xlsx header")
	}

	farmerCache := map[int]string{} // organization_id -> surreal record id

	for i_, row := range rows[1:] {
		if len(row) < 3 {
			continue
		}
		orgID := atoi(getCol(row, idx["organization_id"]))
		shop := getCol(row, idx["shop_name"])
		desc := getCol(row, idx["farmer_description"])
		region := getCol(row, idx["region"])
		category := getCol(row, idx["category"])
		productName := getCol(row, idx["name_product"])
		productID := atoi(getCol(row, idx["product_id"]))
		productDesc := getCol(row, idx["product_description"])
		urlProduct := getCol(row, idx["url_product"])
		urlFarmer := getCol(row, idx["url_farmer"])

		if productID == 0 || shop == "" {
			continue
		}

		farmerRec, ok := farmerCache[orgID]
		if !ok {
			id, err := i.Repo.UpsertFarmer(&models.Farmer{
				OrganizationID: orgID, ShopName: shop, Description: desc,
				Region: region, URL: urlFarmer,
			})
			if err != nil {
				log.Warn().Err(err).Int("org", orgID).Msg("upsert farmer failed")
				continue
			}
			farmerRec = id
			farmerCache[orgID] = id
			farmers++
		}

		_, err := i.Repo.UpsertProduct(&models.Product{
			ProductID: productID, FarmerID: farmerRec,
			Name: productName, Description: productDesc,
			Category: category, URL: urlProduct,
		})
		if err != nil {
			log.Warn().Err(err).Int("pid", productID).Msg("upsert product failed")
			continue
		}
		products++
		if i_%200 == 0 {
			log.Info().Int("row", i_).Int("farmers", farmers).Int("products", products).Msg("importing")
		}
	}
	return farmers, products, nil
}

// --- helpers ----------------------------------------------------------

func indexHeader(h []string) map[string]int {
	keys := []string{
		"organization_id", "shop_name", "farmer_description", "region", "category",
		"name_product", "product_id", "product_description", "url_product", "url_farmer",
	}
	m := map[string]int{}
	for _, k := range keys {
		m[k] = -1
	}
	for i, col := range h {
		for _, k := range keys {
			if col == k {
				m[k] = i
				break
			}
		}
	}
	return m
}

func getCol(row []string, i int) string {
	if i < 0 || i >= len(row) {
		return ""
	}
	return row[i]
}

func atoi(s string) int {
	n := 0
	neg := false
	for i, ch := range s {
		if i == 0 && ch == '-' {
			neg = true
			continue
		}
		if ch < '0' || ch > '9' {
			return 0
		}
		n = n*10 + int(ch-'0')
	}
	if neg {
		return -n
	}
	return n
}

package currency

import "fmt"

var supported = map[string]string{
	"AED": "UAE Dirham",
	"AUD": "Australian Dollar",
	"BRL": "Brazilian Real",
	"CAD": "Canadian Dollar",
	"CHF": "Swiss Franc",
	"CNY": "Chinese Yuan",
	"CZK": "Czech Koruna",
	"DKK": "Danish Krone",
	"EUR": "Euro",
	"GBP": "British Pound",
	"HKD": "Hong Kong Dollar",
	"HUF": "Hungarian Forint",
	"IDR": "Indonesian Rupiah",
	"ILS": "Israeli Shekel",
	"INR": "Indian Rupee",
	"JPY": "Japanese Yen",
	"KRW": "South Korean Won",
	"MXN": "Mexican Peso",
	"MYR": "Malaysian Ringgit",
	"NOK": "Norwegian Krone",
	"NZD": "New Zealand Dollar",
	"PHP": "Philippine Peso",
	"PLN": "Polish Zloty",
	"SAR": "Saudi Riyal",
	"SEK": "Swedish Krona",
	"SGD": "Singapore Dollar",
	"THB": "Thai Baht",
	"TRY": "Turkish Lira",
	"USD": "US Dollar",
	"ZAR": "South African Rand",
}

type Currency struct {
	Code string `json:"code"`
	Name string `json:"name"`
}

func IsSupported(code string) bool {
	_, ok := supported[code]
	return ok
}

func All() []Currency {
	result := make([]Currency, 0, len(supported))
	for code, name := range supported {
		result = append(result, Currency{Code: code, Name: name})
	}
	return result
}

func Validate(code string) error {
	if !IsSupported(code) {
		return fmt.Errorf("unsupported currency: %s", code)
	}
	return nil
}

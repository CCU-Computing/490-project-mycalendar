package moodle

import (
	"encoding/json"
	"fmt"
	"io"
	"mycalendar/internal/config"
	"net/http"
	"net/url"
	"strconv"
	"time"
)

// MoodleError represents an error response from Moodle
type MoodleError struct {
	Exception string `json:"exception"`
	ErrorCode string `json:"errorcode"`
	Message   string `json:"message"`
}

// buildParams builds URL parameters with support for Moodle's array syntax: key[index]=value
func buildParams(params map[string]interface{}) url.Values {
	values := url.Values{}

	for key, val := range params {
		if val == nil {
			continue
		}

		switch v := val.(type) {
		case []interface{}:
			// Generic interface array
			for idx, item := range v {
				values.Add(fmt.Sprintf("%s[%d]", key, idx), fmt.Sprint(item))
			}
		case []string:
			// String array
			for idx, item := range v {
				values.Add(fmt.Sprintf("%s[%d]", key, idx), item)
			}
		case []int:
			// Int array
			for idx, item := range v {
				values.Add(fmt.Sprintf("%s[%d]", key, idx), strconv.Itoa(item))
			}
		case []int64:
			// Int64 array
			for idx, item := range v {
				values.Add(fmt.Sprintf("%s[%d]", key, idx), strconv.FormatInt(item, 10))
			}
		default:
			// Single value
			values.Add(key, fmt.Sprint(val))
		}
	}

	return values
}

// MoodleGet performs a Moodle REST API call
func MoodleGet(token, wsfunction string, params map[string]interface{}) (map[string]interface{}, error) {
	if token == "" {
		return nil, fmt.Errorf("missing token")
	}
	if wsfunction == "" {
		return nil, fmt.Errorf("missing wsfunction")
	}

	// Build base parameters
	baseParams := map[string]interface{}{
		"wstoken":            token,
		"moodlewsrestformat": config.AppConfig.MoodleFormat,
		"wsfunction":         wsfunction,
	}

	// Merge with provided params
	for k, v := range params {
		baseParams[k] = v
	}

	// Build URL
	urlParams := buildParams(baseParams)
	fullURL := fmt.Sprintf("%s?%s", config.AppConfig.MoodleBaseURL, urlParams.Encode())

	// Create HTTP client with timeout
	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	// Make request
	req, err := http.NewRequest("GET", fullURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Accept", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("moodle request failed: %w", err)
	}
	defer resp.Body.Close()

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// Check HTTP status
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("moodle request failed (%d): %s", resp.StatusCode, string(body))
	}

	// Parse JSON
	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		// Try to parse as array (some Moodle endpoints return arrays)
		var arrayResult []interface{}
		if err2 := json.Unmarshal(body, &arrayResult); err2 == nil {
			// Wrap array in a map for consistent return type
			return map[string]interface{}{"data": arrayResult}, nil
		}
		return nil, fmt.Errorf("failed to parse JSON: %w", err)
	}

	// Check for Moodle error
	if exception, ok := result["exception"].(string); ok {
		message := ""
		if msg, ok := result["message"].(string); ok {
			message = msg
		} else if errorcode, ok := result["errorcode"].(string); ok {
			message = errorcode
		}
		return nil, fmt.Errorf("moodle error: %s", message)
	}

	return result, nil
}

// MoodleGetArray performs a Moodle REST API call that returns an array
func MoodleGetArray(token, wsfunction string, params map[string]interface{}) ([]interface{}, error) {
	if token == "" {
		return nil, fmt.Errorf("missing token")
	}
	if wsfunction == "" {
		return nil, fmt.Errorf("missing wsfunction")
	}

	// Build base parameters
	baseParams := map[string]interface{}{
		"wstoken":            token,
		"moodlewsrestformat": config.AppConfig.MoodleFormat,
		"wsfunction":         wsfunction,
	}

	// Merge with provided params
	for k, v := range params {
		baseParams[k] = v
	}

	// Build URL
	urlParams := buildParams(baseParams)
	fullURL := fmt.Sprintf("%s?%s", config.AppConfig.MoodleBaseURL, urlParams.Encode())

	// Create HTTP client with timeout
	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	// Make request
	req, err := http.NewRequest("GET", fullURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Accept", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("moodle request failed: %w", err)
	}
	defer resp.Body.Close()

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// Check HTTP status
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("moodle request failed (%d): %s", resp.StatusCode, string(body))
	}

	// Parse JSON as array
	var result []interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		// Check if it's an error object
		var errorResult map[string]interface{}
		if err2 := json.Unmarshal(body, &errorResult); err2 == nil {
			if exception, ok := errorResult["exception"].(string); ok {
				message := ""
				if msg, ok := errorResult["message"].(string); ok {
					message = msg
				} else if errorcode, ok := errorResult["errorcode"].(string); ok {
					message = errorcode
				}
				return nil, fmt.Errorf("moodle error: %s (%s)", message, exception)
			}
		}
		return nil, fmt.Errorf("failed to parse JSON: %w", err)
	}

	return result, nil
}

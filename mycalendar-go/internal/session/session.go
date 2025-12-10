package session

import (
	"net/http"

	"github.com/gorilla/sessions"
)

const SessionName = "mycalendar_session"

var store *sessions.CookieStore

// InitStore initializes the session store with the given secret
func InitStore(secret string, cookieSecure bool) {
	store = sessions.NewCookieStore([]byte(secret))
	store.Options = &sessions.Options{
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   28800, // 8 hours (in seconds)
		Secure:   cookieSecure,
		Path:     "/",
	}
}

// GetStore returns the session store
func GetStore() *sessions.CookieStore {
	return store
}

// GetSession returns the session for the current request
func GetSession(r *http.Request) (*sessions.Session, error) {
	return store.Get(r, SessionName)
}

// SetUserSession sets user session data
func SetUserSession(w http.ResponseWriter, r *http.Request, userID int64, email string, token string) error {
	session, err := GetSession(r)
	if err != nil {
		return err
	}

	session.Values["userId"] = userID
	session.Values["email"] = email
	session.Values["moodleToken"] = token

	return session.Save(r, w)
}

// ClearSession clears the session data
func ClearSession(w http.ResponseWriter, r *http.Request) error {
	session, err := GetSession(r)
	if err != nil {
		return err
	}

	// Clear all session values
	session.Values = make(map[interface{}]interface{})
	session.Options.MaxAge = -1 // Delete cookie

	return session.Save(r, w)
}

// GetUserID returns the user ID from the session
func GetUserID(r *http.Request) (int64, bool) {
	session, err := GetSession(r)
	if err != nil {
		return 0, false
	}

	userID, ok := session.Values["userId"].(int64)
	return userID, ok
}

// GetMoodleToken returns the Moodle token from the session
func GetMoodleToken(r *http.Request) (string, bool) {
	session, err := GetSession(r)
	if err != nil {
		return "", false
	}

	token, ok := session.Values["moodleToken"].(string)
	return token, ok
}

// IsAuthenticated checks if the user is authenticated
func IsAuthenticated(r *http.Request) bool {
	session, err := GetSession(r)
	if err != nil {
		return false
	}

	// User is authenticated if they have either userId or moodleToken
	_, hasUserID := session.Values["userId"].(int64)
	_, hasMoodleToken := session.Values["moodleToken"].(string)

	return hasUserID || hasMoodleToken
}

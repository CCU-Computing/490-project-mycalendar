package repository

import (
	"database/sql"
	"fmt"
	"mycalendar/internal/database"
	"mycalendar/internal/models"

	"golang.org/x/crypto/bcrypt"
)

const SALT_ROUNDS = 10

// CreateUser creates a new user with hashed password
func CreateUser(email, firstName, lastName, password string, moodleToken *string) (*models.User, error) {
	db, err := database.GetDB()
	if err != nil {
		return nil, fmt.Errorf("failed to get database: %w", err)
	}

	// Hash password
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), SALT_ROUNDS)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	// Convert moodleToken to sql.NullString
	var nullToken sql.NullString
	if moodleToken != nil {
		nullToken = sql.NullString{String: *moodleToken, Valid: true}
	}

	// Insert user
	result, err := db.Exec(
		`INSERT INTO users (email, first_name, last_name, password_hash, moodle_token)
		 VALUES (?, ?, ?, ?, ?)`,
		email, firstName, lastName, string(passwordHash), nullToken,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("failed to get user ID: %w", err)
	}

	return &models.User{
		ID:           id,
		Email:        email,
		FirstName:    firstName,
		LastName:     lastName,
		PasswordHash: string(passwordHash),
		MoodleToken:  nullToken,
	}, nil
}

// GetUserByEmail finds a user by email address
func GetUserByEmail(email string) (*models.User, error) {
	db, err := database.GetDB()
	if err != nil {
		return nil, fmt.Errorf("failed to get database: %w", err)
	}

	var user models.User
	err = db.Get(&user, "SELECT * FROM users WHERE email = ?", email)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get user by email: %w", err)
	}

	return &user, nil
}

// GetUserByID finds a user by ID
func GetUserByID(id int64) (*models.User, error) {
	db, err := database.GetDB()
	if err != nil {
		return nil, fmt.Errorf("failed to get database: %w", err)
	}

	var user models.User
	err = db.Get(&user, "SELECT * FROM users WHERE id = ?", id)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get user by ID: %w", err)
	}

	return &user, nil
}

// VerifyPassword verifies a user's password and returns the user if valid
func VerifyPassword(email, password string) (*models.User, error) {
	user, err := GetUserByEmail(email)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, nil
	}

	// Compare password with hash
	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password))
	if err != nil {
		// Password doesn't match
		return nil, nil
	}

	return user, nil
}

// UpdateMoodleToken updates a user's Moodle token
func UpdateMoodleToken(userID int64, token string) error {
	db, err := database.GetDB()
	if err != nil {
		return fmt.Errorf("failed to get database: %w", err)
	}

	_, err = db.Exec(
		"UPDATE users SET moodle_token = ?, updated_at = datetime('now') WHERE id = ?",
		token, userID,
	)
	if err != nil {
		return fmt.Errorf("failed to update moodle token: %w", err)
	}

	return nil
}

// UpdateUser updates user profile information
func UpdateUser(userID int64, firstName, lastName, email *string) (*models.User, error) {
	db, err := database.GetDB()
	if err != nil {
		return nil, fmt.Errorf("failed to get database: %w", err)
	}

	updates := []string{}
	params := []interface{}{}

	if firstName != nil {
		updates = append(updates, "first_name = ?")
		params = append(params, *firstName)
	}
	if lastName != nil {
		updates = append(updates, "last_name = ?")
		params = append(params, *lastName)
	}
	if email != nil {
		updates = append(updates, "email = ?")
		params = append(params, *email)
	}

	if len(updates) == 0 {
		return GetUserByID(userID)
	}

	updates = append(updates, "updated_at = datetime('now')")
	params = append(params, userID)

	query := fmt.Sprintf("UPDATE users SET %s WHERE id = ?", joinStrings(updates, ", "))
	_, err = db.Exec(query, params...)
	if err != nil {
		return nil, fmt.Errorf("failed to update user: %w", err)
	}

	return GetUserByID(userID)
}

// ChangePassword changes a user's password
func ChangePassword(userID int64, newPassword string) error {
	db, err := database.GetDB()
	if err != nil {
		return fmt.Errorf("failed to get database: %w", err)
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(newPassword), SALT_ROUNDS)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	_, err = db.Exec(
		"UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?",
		string(passwordHash), userID,
	)
	if err != nil {
		return fmt.Errorf("failed to change password: %w", err)
	}

	return nil
}

// DeleteUser deletes a user (cascades to all related data)
func DeleteUser(userID int64) error {
	db, err := database.GetDB()
	if err != nil {
		return fmt.Errorf("failed to get database: %w", err)
	}

	_, err = db.Exec("DELETE FROM users WHERE id = ?", userID)
	if err != nil {
		return fmt.Errorf("failed to delete user: %w", err)
	}

	return nil
}

// GetAllUsers returns all users (for admin/demo purposes)
func GetAllUsers() ([]models.User, error) {
	db, err := database.GetDB()
	if err != nil {
		return nil, fmt.Errorf("failed to get database: %w", err)
	}

	var users []models.User
	err = db.Select(&users, "SELECT id, email, first_name, last_name, created_at FROM users")
	if err != nil {
		return nil, fmt.Errorf("failed to get all users: %w", err)
	}

	return users, nil
}

// joinStrings is a helper function to join strings
func joinStrings(strs []string, sep string) string {
	if len(strs) == 0 {
		return ""
	}
	result := strs[0]
	for i := 1; i < len(strs); i++ {
		result += sep + strs[i]
	}
	return result
}

# Sheet Base Schema

This document defines the base schema for Google Sheets used as database tables in Sheet DB.

## _User

User information table containing authentication and profile data.

- **id** (string, required, unique)
  - User identifier from Auth0
- **name** (string, required)
  - User's display name
- **email** (string, required, unique, pattern: email)
  - User's email address
- **given_name** (string)
  - User's first name
- **family_name** (string)
  - User's last name
- **nickname** (string)
  - User's nickname
- **picture** (string)
  - URL to user's profile picture
- **email_verified** (boolean)
  - Whether the email address has been verified
- **locale** (string)
  - User's locale/language preference
- **created_at** (datetime, required)
  - Record creation timestamp
- **updated_at** (datetime, required)
  - Record last update timestamp
- **public_read** (boolean)
  - Whether this user record is publicly readable
- **public_write** (boolean)
  - Whether this user record is publicly writable
- **role_read** (array)
  - List of roles that can read this user record
- **role_write** (array)
  - List of roles that can write to this user record
- **user_read** (array)
  - List of specific users that can read this user record
- **user_write** (array)
  - List of specific users that can write to this user record

## _Session

Session management table for user authentication tokens.

- **id** (string, required, unique)
  - Session identifier
- **user_id** (string, required)
  - Reference to user ID
- **token** (string, required)
  - Session token (truncated for security)
- **expires_at** (datetime, required)
  - Session expiration timestamp
- **created_at** (datetime, required)
  - Session creation timestamp
- **updated_at** (datetime, required)
  - Session last update timestamp

## _Config

Application configuration table for storing system settings.

- **id** (string, required, unique)
  - Configuration entry identifier
- **name** (string, required, unique)
  - Configuration key name
- **value** (string, required)
  - Configuration value
- **created_at** (datetime, required)
  - Record creation timestamp
- **updated_at** (datetime, required)
  - Record last update timestamp
- **public_read** (boolean)
  - Whether this config is publicly readable
- **public_write** (boolean)
  - Whether this config is publicly writable
- **role_read** (array)
  - List of roles that can read this config
- **role_write** (array)
  - List of roles that can write to this config
- **user_read** (array)
  - List of specific users that can read this config
- **user_write** (array)
  - List of specific users that can write to this config

## _Role

Role-based access control table for managing user permissions.

- **name** (string, required, unique)
  - Role name identifier
- **users** (array)
  - List of users assigned to this role
- **roles** (array)
  - List of child roles (role hierarchy)
- **created_at** (datetime, required)
  - Role creation timestamp
- **updated_at** (datetime, required)
  - Role last update timestamp
- **public_read** (boolean)
  - Whether this role is publicly readable
- **public_write** (boolean)
  - Whether this role is publicly writable
- **role_read** (array)
  - List of roles that can read this role
- **role_write** (array)
  - List of roles that can write to this role
- **user_read** (array)
  - List of specific users that can read this role
- **user_write** (array)
  - List of specific users that can write to this role

## Schema Format

The second row of each sheet contains schema definitions in JSON format for enhanced validation:

```json
{
  "type": "string|number|boolean|datetime|array|json",
  "required": true|false,
  "unique": true|false,
  "pattern": "regex_pattern",
  "minLength": number,
  "maxLength": number,
  "min": number,
  "max": number,
  "default": any
}
```

For simple types without constraints, the type name can be used directly (e.g., "string", "number").
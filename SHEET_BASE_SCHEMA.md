# Sheet Base Schema

## _User

- id
  string
- name
  string
- email
  string
- given_name
  string
- family_name
  string
- nickname
  string
- picture
  string
- email_verified
  boolean
- locale
  string
- created_at
  datetime
- updated_at
  datetime
- public_read
  boolean
- public_write
  boolean
- role_read
  array
- role_write
  array
- user_read
  array
- user_write
  array

## _Session

- id
  string
- user_id
  string
- token
  string
- expires_at
  datetime
- created_at
  datetime
- updated_at
  datetime

## _Config

- id
  string
- name
  string
- value
  string
- created_at
  datetime
- updated_at
  datetime
- public_read
  boolean
- public_write
  boolean
- role_read
  array
- role_write
  array
- user_read
  array
- user_write
  array

## _Role

- name
  string
- users
  array
- roles
  array
- created_at
  datetime
- updated_at
  datetime
- public_read
  boolean
- public_write
  boolean
- role_read
  array
- role_write
  array
- user_read
  array
- user_write
  array

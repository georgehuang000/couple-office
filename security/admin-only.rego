package authz.user

default allow := false

# The mini program may invoke cloud functions. Document database resources are
# intentionally not allowed here; only server-side functions read or write them.
allow if {
  input.cloudbase.resource_type == "functions"
  input.subject.auth_type == "anonymous"
}

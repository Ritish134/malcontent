rule pypi_packages : override {
  meta:
    description = "pypi_package_index.json"
    killer_miner_panchansminingisland = "low"
    linux_rootkit_terms = "low"
    multiple_pools = "low"
  strings:
    $index_date = "\"index_date\""
    $package_names = "\"package_names\":["
    $s_awscli = "awscli" fullword
    $s_numpy = "numpy" fullword
    $s_pandas = "pandas" fullword
    $s_polars = "polars" fullword
    $s_pulumi_awsx = "pulumi-awsx"
    $s_pygithub = "pygithub" fullword
    $s_windmill = "windmill" fullword
  condition:
    $index_date and $package_names and 5 of ($s*)
}
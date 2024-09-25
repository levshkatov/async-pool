#!/bin/bash

# File to execute 1000 times
files_to_execute=(
  "./worker-thread/pool.mjs"
  "./pool-1.mjs"
  "./pool.mjs"
)

# Number of times to execute the file
num_executions=5

for file in "${files_to_execute[@]}"
do
  for ((i=1; i<=num_executions; i++)); do
    node $file
  done
done

echo "Executed $file_to_execute $num_executions times."


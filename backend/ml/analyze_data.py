import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
import matplotlib.pyplot as plt

# Read the latest fixed data
df = pd.read_csv('ml/training_data/processed_features_gucci_20250722_173707_fixed.csv')

# Print basic stats
print("\nEngagement Rate Statistics:")
print(df['engagement_rate'].describe())

print("\nTop 5 Most Engaging Posts:")
top_posts = df.nlargest(5, 'engagement_rate')[['content_length', 'hashtag_count', 'has_image', 'engagement_rate', 'total_engagement']]
print(top_posts)

print("\nFeature Correlations with Engagement:")
correlations = df.corr()['engagement_rate'].sort_values(ascending=False)
print(correlations)

# Save analysis
with open('ml/training_data/data_analysis.txt', 'w') as f:
    f.write("Engagement Rate Statistics:\n")
    f.write(str(df['engagement_rate'].describe()))
    f.write("\n\nTop 5 Most Engaging Posts:\n")
    f.write(str(top_posts))
    f.write("\n\nFeature Correlations with Engagement:\n")
    f.write(str(correlations)) 
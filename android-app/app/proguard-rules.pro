# Keep BouncyCastle classes (loaded reflectively by JCA)
-keep class org.bouncycastle.** { *; }
-dontwarn org.bouncycastle.**

# kotlinx.serialization reflection
-keepattributes RuntimeVisible*Annotations, AnnotationDefault
-keepclassmembers class **$$serializer { *; }
